// Nama File: Code.gs

function doGet(e) {
  var action = e.parameter.action;
  var params = e.parameter;

  // ── TAMBAHKAN BLOK INI ── (taruh di bagian paling atas if/else)
  if (params.action === 'listFolder') {
    var folderId = params.folderId;
    if (!folderId) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'folderId diperlukan' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try {
      var files = listFolderFiles(folderId);
      return ContentService
        .createTextOutput(JSON.stringify({ files: files }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: err.message, files: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // ── AKHIR BLOK TAMBAHAN ──
  
  
  // LOGIKA UTAMA: Mengambil foto native dari Folder Google Drive
  if (action === "getAlbumPhotos") {
    var folderId = e.parameter.folderId;
    
    try {
      if (!folderId) {
        throw new Error("Parameter folderId tidak ditemukan.");
      }
      
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      var photoList = [];
      
      while (files.hasNext()) {
        var file = files.next();
        var mimeType = file.getMimeType();
        
        // Hanya ambil file yang berupa format gambar
        if (mimeType.indexOf("image/") !== -1) {
          photoList.push({
            id: file.getId(),
            name: file.getName(),
            // Menggunakan hotlink profil rahasia agar bypass pemblokiran CORS browser
            url: "https://lh3.googleusercontent.com/d/" + file.getId()
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        photos: photoList 
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // LOGIKA CADANGAN: Mengambil data utama jika tidak ada action parameter
  try {
    var fullContent = getSiteData(); 
    return ContentService.createTextOutput(JSON.stringify(fullContent))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var data = requestData.data;
    
    if (action === "updateContent") {
      saveSiteData(data);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "updateUmat") {
      saveUmatData(data);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "updateGaleriAlbum") {
      saveGaleriAlbumData(data);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "uploadImage") {
      var folder = getOrCreateFolder("IMKKSA_Beranda_Images");
      if (!folder) throw new Error("Gagal mengakses folder Google Drive");
      var fileName = "IMG_" + Date.now();
      var uploadResult = uploadBase64ToFolder(data.base64, fileName, folder);
      return ContentService.createTextOutput(JSON.stringify(uploadResult))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action tidak dikenal" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper to save large properties by splitting them into chunks if they exceed 9KB
function setLargeProperty(key, valueStr) {
  var properties = PropertiesService.getScriptProperties();
  
  // Delete any existing chunked properties for this key to prevent orphan chunks
  var allProperties = properties.getProperties();
  for (var propKey in allProperties) {
    if (propKey === key || propKey.indexOf(key + "_chunk_") === 0 || propKey === key + "_chunks") {
      properties.deleteProperty(propKey);
    }
  }
  
  var chunkSize = 8000; // safe limit below 9KB (9000 bytes)
  if (valueStr.length <= chunkSize) {
    properties.setProperty(key, valueStr);
  } else {
    var chunkCount = Math.ceil(valueStr.length / chunkSize);
    properties.setProperty(key + "_chunks", chunkCount.toString());
    for (var i = 0; i < chunkCount; i++) {
      var chunk = valueStr.substring(i * chunkSize, (i + 1) * chunkSize);
      properties.setProperty(key + "_chunk_" + i, chunk);
    }
  }
}

// Helper to load large properties that may have been split into chunks
function getLargeProperty(key, defaultValue) {
  var properties = PropertiesService.getScriptProperties();
  var chunkCountStr = properties.getProperty(key + "_chunks");
  
  if (chunkCountStr) {
    var chunkCount = parseInt(chunkCountStr, 10);
    var valueStr = "";
    for (var i = 0; i < chunkCount; i++) {
      var chunk = properties.getProperty(key + "_chunk_" + i);
      if (chunk) {
        valueStr += chunk;
      }
    }
    return valueStr;
  }
  
  var normalValue = properties.getProperty(key);
  return normalValue !== null ? normalValue : defaultValue;
}

function getSiteData() {
  var settings = {"logo": "/LOGO_KARO.jpg", "title": "IMKKSA Banda Aceh Sekitar"};
  var pages = {};
  var umat = [];
  var pengurus = [];
  var galeriAlbum = [];
  
  try {
    var settingsStr = getLargeProperty("settings", null);
    if (settingsStr) settings = JSON.parse(settingsStr);
  } catch (e) {
    Logger.log("Error parsing settings: " + e.toString());
  }
  
  try {
    var pagesStr = getLargeProperty("pages", null);
    if (pagesStr) {
      try {
        pages = JSON.parse(pagesStr);
      } catch (jsonErr) {
        Logger.log("Error parsing pages, attempting recovery: " + jsonErr.toString());
        var base64Idx = pagesStr.indexOf("data:image");
        if (base64Idx !== -1) {
          var imgStartIdx = pagesStr.lastIndexOf("<img src=\\\"", base64Idx);
          if (imgStartIdx !== -1) {
            // Reconstruct a valid JSON closing by replacing the massive base64 string
            var testStr = pagesStr.substring(0, imgStartIdx) + ' (Gambar dihapus karena format base64 terlalu besar, silakan upload kembali)<\/p>\"}}';
            try {
              pages = JSON.parse(testStr);
              setLargeProperty("pages", testStr);
              Logger.log("Pages recovery successful!");
            } catch (err2) {
              Logger.log("Pages recovery failed: " + err2.toString());
            }
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Error parsing pages: " + e.toString());
  }
  
  try {
    var umatStr = getLargeProperty("umat", null);
    if (umatStr) umat = JSON.parse(umatStr);
  } catch (e) {
    Logger.log("Error parsing umat: " + e.toString());
  }
  
  try {
    var pengurusStr = getLargeProperty("pengurus", null);
    if (pengurusStr) pengurus = JSON.parse(pengurusStr);
  } catch (e) {
    Logger.log("Error parsing pengurus: " + e.toString());
  }
  
  try {
    var galeriAlbumStr = getLargeProperty("galeriAlbum", null);
    if (galeriAlbumStr) galeriAlbum = JSON.parse(galeriAlbumStr);
  } catch (e) {
    Logger.log("Error parsing galeriAlbum: " + e.toString());
  }
  
  return {
    settings: settings,
    pages: pages,
    umat: umat,
    pengurus: pengurus,
    galeriAlbum: galeriAlbum
  };
}

function saveSiteData(data) {
  if (data.settings) setLargeProperty("settings", JSON.stringify(data.settings));
  if (data.pages) setLargeProperty("pages", JSON.stringify(data.pages));
}

function getOrCreateFolder(folderName) {
  try {
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    } else {
      var folder = DriveApp.createFolder(folderName);
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log("Gagal share folder: " + shareErr.toString());
      }
      return folder;
    }
  } catch (err) {
    Logger.log("Gagal akses DriveApp: " + err.toString());
    return null;
  }
}

function uploadBase64ToFolder(base64Data, fileName, folder) {
  try {
    var parts = base64Data.split(",");
    var meta = parts[0];
    var rawBase64 = parts[1];
    
    var mimeType = "image/jpeg";
    var mimeMatch = meta.match(/data:(.*?);/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
    
    var extension = "jpg";
    if (mimeType === "image/png") extension = "png";
    else if (mimeType === "image/gif") extension = "gif";
    else if (mimeType === "image/webp") extension = "webp";
    
    var fullFileName = fileName + "." + extension;
    var decoded = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decoded, mimeType, fullFileName);
    
    var file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Gagal share file: " + shareErr.toString());
    }
    
    var url = "https://lh3.googleusercontent.com/d/" + file.getId();
    return { success: true, url: url };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function testGoogleDrive() {
  var folder = getOrCreateFolder("IMKKSA_Anggota_Dokumen");
  if (folder) {
    Logger.log("Koneksi Google Drive Sukses! Folder ID: " + folder.getId());
  } else {
    Logger.log("Koneksi Google Drive Gagal!");
  }
}

function saveUmatData(umatList) {
  if (!umatList) {
    Logger.log("saveUmatData dipanggil tanpa parameter (umatList kosong).");
    return;
  }
  var folder = getOrCreateFolder("IMKKSA_Anggota_Dokumen");
  
  for (var i = 0; i < umatList.length; i++) {
    var umat = umatList[i];
    
    if (folder) {
      // Upload photo if it's base64 data
      if (umat.photo && umat.photo.indexOf("data:") === 0) {
        var fileName = "PHOTO_" + umat.nama.replace(/[^a-zA-Z0-9]/g, "_") + "_" + Date.now();
        var uploadResult = uploadBase64ToFolder(umat.photo, fileName, folder);
        if (uploadResult.success) {
          umat.photo = uploadResult.url;
        }
      }
      
      // Upload KK if it's base64 data
      if (umat.kk && umat.kk.indexOf("data:") === 0) {
        var fileName = "KK_" + umat.nama.replace(/[^a-zA-Z0-9]/g, "_") + "_" + Date.now();
        var uploadResult = uploadBase64ToFolder(umat.kk, fileName, folder);
        if (uploadResult.success) {
          umat.kk = uploadResult.url;
        }
      }
    }
  }
  
  try {
    setLargeProperty("umat", JSON.stringify(umatList));
  } catch (propErr) {
    Logger.log("Gagal menyimpan data umat lengkap, membersihkan base64: " + propErr.toString());
    for (var i = 0; i < umatList.length; i++) {
      if (umatList[i].photo && umatList[i].photo.indexOf("data:") === 0) {
        umatList[i].photo = "";
      }
      if (umatList[i].kk && umatList[i].kk.indexOf("data:") === 0) {
        umatList[i].kk = "";
      }
    }
    setLargeProperty("umat", JSON.stringify(umatList));
  }
}

function saveGaleriAlbumData(albumList) {
  setLargeProperty("galeriAlbum", JSON.stringify(albumList));
}

function listFolderFiles(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var result = [];
    while (files.hasNext()) {
      var file = files.next();
      var mimeType = file.getMimeType();
      // Hanya ambil gambar
      if (mimeType.indexOf('image/') === 0) {
        result.push({
          id: file.getId(),
          name: file.getName(),
          mimeType: mimeType,
        });
      }
    }
    return result;
  } catch (e) {
    throw new Error('Folder tidak ditemukan atau tidak dapat diakses: ' + e.message);
  }
}

