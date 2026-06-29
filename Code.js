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

function saveUmatData(umatList) {
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

