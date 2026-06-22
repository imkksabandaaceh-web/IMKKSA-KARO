function doGet(e) {
  const url = "https://xxxx.supabase.co/rest/v1/pengurus";
  const apiKey = "SUPABASE_ANON_KEY";

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "apikey": apiKey,
      "Authorization": "Bearer " + apiKey
    }
  });

  return ContentService.createTextOutput(response.getContentText())
    .setMimeType(ContentService.MimeType.JSON);
}
