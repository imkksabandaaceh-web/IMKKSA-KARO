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
    } else if (action === "updateUmat") {
      saveUmatData(data);
    } else if (action === "updateGaleriAlbum") {
      saveGaleriAlbumData(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSiteData() {
  var properties = PropertiesService.getScriptProperties();
  var settings = JSON.parse(properties.getProperty("settings") || '{"logo": "/LOGO_KARO.jpg", "title": "IMKKSA Banda Aceh Sekitar"}');
  var pages = JSON.parse(properties.getProperty("pages") || '{}');
  var umat = JSON.parse(properties.getProperty("umat") || '[]');
  var pengurus = JSON.parse(properties.getProperty("pengurus") || '[]');
  var galeriAlbum = JSON.parse(properties.getProperty("galeriAlbum") || '[]');
  
  return {
    settings: settings,
    pages: pages,
    umat: umat,
    pengurus: pengurus,
    galeriAlbum: galeriAlbum
  };
}

function saveSiteData(data) {
  var properties = PropertiesService.getScriptProperties();
  if (data.settings) properties.setProperty("settings", JSON.stringify(data.settings));
  if (data.pages) properties.setProperty("pages", JSON.stringify(data.pages));
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    var folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return folder;
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
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var url = "https://lh3.googleusercontent.com/d/" + file.getId();
    return { success: true, url: url };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function saveUmatData(umatList) {
  var folder = getOrCreateFolder("IMKKSA_Anggota_Dokumen");
  
  for (var i = 0; i < umatList.length; i++) {
    var umat = umatList[i];
    
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
  
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty("umat", JSON.stringify(umatList));
}

function saveGaleriAlbumData(albumList) {
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty("galeriAlbum", JSON.stringify(albumList));
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

