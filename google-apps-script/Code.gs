// Set this to your Spreadsheet ID.
var SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";

var SHEET_NAMES = {
  PROGRAMS: 'Programs',
  ATTENDANCE: 'Attendance',
  RESPONDERS: 'Responders',
  CASE_REPORTS: 'CaseReports',
  PROGRAM_DETAILS: 'ProgramDetails'
};

var PROGRAM_DETAILS_HEADERS = ["ID_Detail", "ID_Program", "Jenis", "Kolum_A", "Kolum_B", "Kolum_C", "Kolum_D", "Kolum_E", "DirekodkanPada"];

// Use a global variable for caching the spreadsheet object to avoid re-opening it on every call.
var SSid = null;

/**
 * Gets the active spreadsheet, caching it for efficiency.
 * Throws an error if the spreadsheet cannot be opened.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
 */
function mecc_getActiveSpreadsheet() {
  if (SSid === null) {
    try {
      SSid = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch(e) {
      Logger.log("Error opening spreadsheet with ID '" + SPREADSHEET_ID + "': " + e.message);
      throw new Error("Could not open spreadsheet. Please verify SPREADSHEET_ID and permissions.");
    }
  }
  return SSid;
}


var SUPPORTED_GET_ACTIONS = [
  "ping", 
  "getPrograms", 
  "getDashboard", 
  "getNewProgramId", 
  "getLatestProgram", 
  "validateSheets",
  "getConfig",
  "getCaseReports",
  "getProgramDetails"
];

/**
 * Ensures a sheet with the given name exists and has the specified headers.
 * If the sheet or headers are missing, they will be created.
 * @param {string} sheetName The name of the sheet to ensure exists.
 * @param {string[]} headers An array of header strings for the first row.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
 */
function mecc_ensureSheetWithHeaders(sheetName, headers) {
  var spreadsheet = mecc_getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    Logger.log("Sheet '" + sheetName + "' was not found and has been created.");
  }

  if (sheet.getLastRow() < 1) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    Logger.log("Headers have been written to the new sheet '" + sheetName + "'.");
  }
  return sheet;
}


function mecc_response(data, success) {
  if (typeof success === 'undefined') {
    success = true;
  }
  var output = JSON.stringify({ success: success, data: data });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

function mecc_getHeaderMap(sheet) {
  if (!sheet || sheet.getLastColumn() === 0) return {};
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(header, i) { map[header.trim()] = i; });
  return map;
}

function mecc_isProgramsSheetEmpty(sheet) {
  return sheet.getLastRow() < 2;
}

function mecc_generateNextProgramId() {
  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAMES.PROGRAMS + "' not found");

  var today = new Date();
  var prefix = today.getFullYear().toString() + ('0' + (today.getMonth() + 1)).slice(-2) + ('0' + today.getDate()).slice(-2);

  if (mecc_isProgramsSheetEmpty(sheet)) return prefix + "-0001";

  var headerMap = mecc_getHeaderMap(sheet);
  var idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  var idColIndex = headerMap[idHeader];
  if (idColIndex === undefined) throw new Error("ID column ('ID Program' or 'id') not found in sheet '" + SHEET_NAMES.PROGRAMS + "'.");
  
  var idColumn = idColIndex + 1;
  var allIds = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues().map(function(row) { return row[0]; });
  var todaysIds = allIds.filter(function(id) { return id && id.toString().startsWith(prefix); });
  
  var maxCounter = 0;
  todaysIds.forEach(function(id) {
    var counter = parseInt(id.toString().split('-')[1], 10);
    if (!isNaN(counter) && counter > maxCounter) maxCounter = counter;
  });

  return prefix + "-" + ('0000' + (maxCounter + 1)).slice(-4);
}

function mecc_validateSheetStructure(sheetName) {
  var sheet = mecc_getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { isValid: false, message: "Sheet '" + sheetName + "' not found." };
  
  var headerMap = mecc_getHeaderMap(sheet);
  var missing = [];

  var requiredHeaders = {};
  requiredHeaders[SHEET_NAMES.PROGRAMS] = ["ID Program", "Nama Program"];
  requiredHeaders[SHEET_NAMES.ATTENDANCE] = ["Nama Responder", "Mula Tugas"];
  requiredHeaders[SHEET_NAMES.CASE_REPORTS] = ["ID Kes", "ID Program"];
  requiredHeaders[SHEET_NAMES.PROGRAM_DETAILS] = PROGRAM_DETAILS_HEADERS;
  
  if (requiredHeaders[sheetName]) {
    requiredHeaders[sheetName].forEach(function(h) {
      if (!headerMap.hasOwnProperty(h)) {
        if (h === "ID Program" && headerMap.hasOwnProperty("id")) return;
        missing.push(h);
      }
    });
  }

  if (missing.length > 0) {
    return { isValid: false, message: "Missing required columns: " + missing.join(', ') + "." };
  }

  return { isValid: true, message: "Sheet has the required headers." };
}

function mecc_validateSheets() {
  var results = {
    programs: mecc_validateSheetStructure(SHEET_NAMES.PROGRAMS),
    attendance: mecc_validateSheetStructure(SHEET_NAMES.ATTENDANCE),
    caseReports: mecc_validateSheetStructure(SHEET_NAMES.CASE_REPORTS),
    programDetails: mecc_validateSheetStructure(SHEET_NAMES.PROGRAM_DETAILS)
  };
  return mecc_response(results, true);
}

function doGet(e) {
  if (SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") {
    return mecc_response("SERVER NOT CONFIGURED: Please set the SPREADSHEET_ID in the Code.gs file.", false);
  }
  var params = e.parameter;
  if (!params.type) return mecc_response("Parameter 'type' diperlukan.", false);
  
  var type = String(params.type).trim();

  try {
    switch (type) {
      case "ping": return mecc_response("pong");
      case "getPrograms": return mecc_getPrograms();
      case "getDashboard": return mecc_getDashboard();
      case "getNewProgramId": return mecc_response(mecc_generateNextProgramId());
      case "getLatestProgram": return mecc_getLatestProgram();
      case "validateSheets": return mecc_validateSheets();
      case "getCaseReports": return mecc_getCaseReports(params.programId);
      case "getProgramDetails": return mecc_getProgramDetails(params.programId);
      case "getConfig": return mecc_response({ actions: SUPPORTED_GET_ACTIONS, sheetNames: SHEET_NAMES, spreadsheetId: SPREADSHEET_ID });
      default: return mecc_response("Action GET tidak dikenali: " + type, false);
    }
  } catch (error) {
    Logger.log("Error in doGet for type '" + type + "': " + error.message + "\nStack: " + error.stack);
    return mecc_response("Error in doGet: " + error.message, false);
  }
}

function doPost(e) {
  if (SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") {
    return mecc_response("SERVER NOT CONFIGURED: Please set the SPREADSHEET_ID in the Code.gs file.", false);
  }
  try {
    var body = JSON.parse(e.postData.contents);
    switch(body.action) {
      case 'saveProgram': return mecc_saveProgram(body.payload);
      case 'updateProgram': return mecc_updateProgram(body.payload);
      case 'setProgramStatus': return mecc_setProgramStatus(body.payload);
      case 'updateCaseStatus': return mecc_updateCaseStatus(body.payload);
      case 'saveProgramDetail': return mecc_saveProgramDetail(body.payload);
      case 'updateProgramDetail': return mecc_updateProgramDetail(body.payload);
      case 'saveFeatureListToDocs': return mecc_saveFeatureListToDocs(body.payload);
      case 'sendFeedback': return mecc_sendFeedback(body.payload);
      case 'addSampleData': return mecc_addSampleDataToLatestProgram();
      default: return mecc_response('Action POST tidak dikenali: ' + body.action, false);
    }
  } catch (error) {
    Logger.log("Error in doPost: " + error.message + "\nStack: " + error.stack);
    return mecc_response("Error in doPost: " + error.message, false);
  }
}

function mecc_getPrograms() {
  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) return mecc_response("Sheet '" + SHEET_NAMES.PROGRAMS + "' not found", false);
  if (sheet.getLastRow() < 2) return mecc_response([]);

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var headerMap = mecc_getHeaderMap(sheet);
  
  var idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  var idIndex = headerMap[idHeader], 
        nameIndex = headerMap["Nama Program"], 
        dateIndex = headerMap["Tarikh"], 
        timeIndex = headerMap["Masa"], 
        locationIndex = headerMap["Lokasi"], 
        lockedIndex = headerMap["Locked"],
        statusIndex = headerMap["status"];

  if (idIndex === undefined || nameIndex === undefined) return mecc_response("Required columns ('" + idHeader + "', 'Nama Program') not found.", false);

  var result = data.map(function(r) {
    return { 
      id: r[idIndex], 
      namaprogram: r[nameIndex], 
      tarikh: r[dateIndex], 
      masa: r[timeIndex], 
      lokasi: r[locationIndex], 
      locked: r[lockedIndex],
      status: r[statusIndex]
    };
  }).filter(function(p) { return p.id && p.namaprogram; });
  return mecc_response(result);
}

function mecc_getLatestProgram() {
  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet || sheet.getLastRow() < 2) return mecc_response("Tiada program ditemui", false);
  
  var headerMap = mecc_getHeaderMap(sheet);
  var idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  var idIndex = headerMap[idHeader], nameIndex = headerMap["Nama Program"];

  if (idIndex === undefined || nameIndex === undefined) return mecc_response("Required columns ('" + idHeader + "', 'Nama Program') not found.", false);

  var data = sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  return mecc_response({ id: data[idIndex], namaprogram: data[nameIndex] });
}

function mecc_getDashboard() {
  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ATTENDANCE);
  if (!sheet) return mecc_response("Sheet '" + SHEET_NAMES.ATTENDANCE + "' not found.", false);
  if (sheet.getLastRow() < 2) return mecc_response([]);

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var headerMap = mecc_getHeaderMap(sheet);
  
  var nameIndex = headerMap["Nama Responder"], startIndex = headerMap["Mula Tugas"], endIndex = headerMap["Tamat Tugas"], caseIndex = headerMap["Jumlah Kes"];
  if (nameIndex === undefined || startIndex === undefined) return mecc_response("Required columns 'Nama Responder' and 'Mula Tugas' not found.", false);

  var result = data.map(function(r) { return { nama: r[nameIndex], mula: r[startIndex], tamat: r[endIndex] || null, kes: r[caseIndex] || 0 }; }).filter(function(att) { return att.nama; });
  return mecc_response(result);
}

function mecc_saveProgram(payload) {
    var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
    if (!sheet) return mecc_response("Sheet '" + SHEET_NAMES.PROGRAMS + "' not found", false);
    
    var newId = mecc_generateNextProgramId();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = new Array(headers.length);
    var idHeader = headers.indexOf("ID Program") > -1 ? "ID Program" : "id";
    
    var rowData = { 
      "Nama Program": payload.name, 
      "Tarikh": payload.date, 
      "Masa": payload.time, 
      "Lokasi": payload.location, 
      "Last Update": new Date(), 
      "Locked": false,
      "status": "Belum Mula"
    };
    rowData[idHeader] = newId;

    headers.forEach(function(h, i) { newRow[i] = rowData[h.trim()] || ""; });
    sheet.appendRow(newRow);
    return mecc_response({ message: "Program saved", newProgram: { id: newId, namaprogram: payload.name } });
}

function mecc_updateProgram(payload) {
  var id = payload.id;
  if (!id) return mecc_response("'id' is required for update.", false);

  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) return mecc_response("Sheet '" + SHEET_NAMES.PROGRAMS + "' not found", false);
  
  var headerMap = mecc_getHeaderMap(sheet);
  var idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  var ids = sheet.getRange(2, headerMap[idHeader] + 1, sheet.getLastRow() - 1, 1).getValues().map(function(row) { return row[0]; });
  var rowIndex = ids.findIndex(function(rowId) { return rowId == id; });

  if (rowIndex === -1) return mecc_response("Program with ID '" + id + "' not found.", false);

  var rowToUpdate = rowIndex + 2;
  var clientToSheetMapping = { namaprogram: "Nama Program", tarikh: "Tarikh", masa: "Masa", lokasi: "Lokasi", locked: "Locked" };

  var updates = Object.assign({}, payload);
  delete updates.id;

  Object.keys(updates).forEach(function(key) {
    var sheetColName = clientToSheetMapping[key];
    if (sheetColName && headerMap[sheetColName] !== undefined) {
      sheet.getRange(rowToUpdate, headerMap[sheetColName] + 1).setValue(updates[key]);
    }
  });
  if (headerMap["Last Update"] !== undefined) sheet.getRange(rowToUpdate, headerMap["Last Update"] + 1).setValue(new Date());

  return mecc_response({ message: "Program " + id + " updated." });
}

function mecc_setProgramStatus(payload) {
  var programId = payload.programId;
  var status = payload.status;
  if (!programId || !status) return mecc_response("'programId' and 'status' are required.", false);

  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) return mecc_response("Sheet '" + SHEET_NAMES.PROGRAMS + "' not found", false);

  var headerMap = mecc_getHeaderMap(sheet);
  var idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  var idCol = headerMap[idHeader];
  var statusCol = headerMap["status"];

  if (idCol === undefined || statusCol === undefined) {
    return mecc_response("Required columns ('" + idHeader + "', 'status') not found.", false);
  }

  var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  var values = dataRange.getValues();
  var programFound = false;

  if (status === 'Aktif') {
    // Deactivate any other active program
    for (var i = 0; i < values.length; i++) {
      if (values[i][statusCol] === 'Aktif') {
        values[i][statusCol] = 'Belum Mula';
      }
    }
  }

  // Set the target program's status
  for (var j = 0; j < values.length; j++) {
    if (values[j][idCol] == programId) {
      values[j][statusCol] = status;
      programFound = true;
      if (status !== 'Aktif') {
        break; 
      }
    }
  }

  if (!programFound) {
    return mecc_response("Program with ID '" + programId + "' not found.", false);
  }

  dataRange.setValues(values);
  return mecc_response({ message: "Program " + programId + " status updated to " + status + "." });
}


function mecc_getCaseReports(programId) {
  if (!programId) return mecc_response("'programId' is required.", false);
  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CASE_REPORTS);
  if (!sheet || sheet.getLastRow() < 2) return mecc_response([]);

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var headerMap = mecc_getHeaderMap(sheet);
  
  var indices = { id: headerMap["ID Kes"], progId: headerMap["ID Program"], details: headerMap["Butiran"], status: headerMap["Status"], ts: headerMap["Masa Laporan"], loc: headerMap["Lokasi"] };
  if (Object.keys(indices).some(function(key) { return indices[key] === undefined; })) {
    return mecc_response("Sheet '" + SHEET_NAMES.CASE_REPORTS + "' is missing columns.", false);
  }

  var result = data.filter(function(r) { return r[indices.progId] == programId; }).map(function(r) {
    return { id: r[indices.id], programId: r[indices.progId], details: r[indices.details], status: r[indices.status], timestamp: r[indices.ts], location: r[indices.loc] };
  });
  return mecc_response(result);
}

function mecc_updateCaseStatus(payload) {
  var id = payload.id;
  var status = payload.status;
  if (!id || !status) return mecc_response("'id' and 'status' are required.", false);

  var sheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CASE_REPORTS);
  if (!sheet) return mecc_response("Sheet '" + SHEET_NAMES.CASE_REPORTS + "' not found", false);

  var headerMap = mecc_getHeaderMap(sheet);
  var idCol = headerMap["ID Kes"] + 1, statusCol = headerMap["Status"] + 1;
  var ids = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getValues().map(function(row) { return row[0]; });
  var rowIndex = ids.findIndex(function(rowId) { return rowId == id; });

  if (rowIndex === -1) return mecc_response("Case with ID '" + id + "' not found.", false);

  sheet.getRange(rowIndex + 2, statusCol).setValue(status);
  return mecc_response({ message: "Case " + id + " status updated." });
}

function mecc_getProgramDetails(programId) {
    if (!programId) return mecc_response("'programId' is required.", false);

    var sheet = mecc_ensureSheetWithHeaders(SHEET_NAMES.PROGRAM_DETAILS, PROGRAM_DETAILS_HEADERS);
    if (sheet.getLastRow() < 2) return mecc_response([]);

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var h = mecc_getHeaderMap(sheet);
    if (!h.ID_Program) return mecc_response("ID_Program column missing.", false);

    return mecc_response(data.filter(function(r) { return r[h.ID_Program] == programId; }).map(function(r) {
        var jenis = r[h.Jenis];
        var base = { id: r[h.ID_Detail], programId: r[h.ID_Program], jenis: jenis, timestamp: r[h.DirekodkanPada] };
        if (jenis === 'Cekpoint') return Object.assign(base, { name: r[h.Kolum_A], location: r[h.Kolum_B], pic: r[h.Kolum_C], callSign: r[h.Kolum_D], crew: r[h.Kolum_E] });
        if (jenis === 'Ambulan') return Object.assign(base, { callSign: r[h.Kolum_A], vehicleNumber: r[h.Kolum_B], crew: r[h.Kolum_C] });
        if (jenis === 'Lain') return Object.assign(base, { title: r[h.Kolum_A], details: r[h.Kolum_B] });
        return base;
    }));
}

function mecc_saveProgramDetail(payload) {
    var sheet = mecc_ensureSheetWithHeaders(SHEET_NAMES.PROGRAM_DETAILS, PROGRAM_DETAILS_HEADERS);
    
    var headers = mecc_getHeaderMap(sheet);
    var newRow = new Array(Object.keys(headers).length).fill('');
    var newId = 'DET-' + Date.now();
    
    var programId = payload.programId;
    var jenis = payload.jenis;
    var data = Object.assign({}, payload);
    delete data.programId;
    delete data.jenis;

    newRow[headers.ID_Detail] = newId;
    newRow[headers.ID_Program] = programId;
    newRow[headers.Jenis] = jenis;
    newRow[headers.DirekodkanPada] = new Date();

    var mappedData = { id: newId, programId: programId, jenis: jenis, timestamp: newRow[headers.DirekodkanPada] };

    if (jenis === 'Cekpoint') {
        newRow[headers.Kolum_A] = data.name; mappedData.name = data.name;
        newRow[headers.Kolum_B] = data.location; mappedData.location = data.location;
        newRow[headers.Kolum_C] = data.pic; mappedData.pic = data.pic;
        newRow[headers.Kolum_D] = data.callSign; mappedData.callSign = data.callSign;
        newRow[headers.Kolum_E] = data.crew; mappedData.crew = data.crew;
    } else if (jenis === 'Ambulan') {
        newRow[headers.Kolum_A] = data.callSign; mappedData.callSign = data.callSign;
        newRow[headers.Kolum_B] = data.vehicleNumber; mappedData.vehicleNumber = data.vehicleNumber;
        newRow[headers.Kolum_C] = data.crew; mappedData.crew = data.crew;
    } else if (jenis === 'Lain') {
        newRow[headers.Kolum_A] = data.title; mappedData.title = data.title;
        newRow[headers.Kolum_B] = data.details; mappedData.details = data.details;
    }
    
    sheet.appendRow(newRow);
    return mecc_response(mappedData);
}

function mecc_updateProgramDetail(payload) {
  if (!payload || !payload.id) return mecc_response("'id' is required for update.", false);

  var sheet = mecc_ensureSheetWithHeaders(SHEET_NAMES.PROGRAM_DETAILS, PROGRAM_DETAILS_HEADERS);
  var headerMap = mecc_getHeaderMap(sheet);
  
  var idColIndex = headerMap["ID_Detail"];
  if (idColIndex === undefined) return mecc_response("Column 'ID_Detail' not found.", false);

  var ids = sheet.getRange(2, idColIndex + 1, sheet.getLastRow() - 1, 1).getValues().map(function(row) { return row[0]; });
  var rowIndex = ids.findIndex(function(rowId) { return rowId == payload.id; });
  
  if (rowIndex === -1) return mecc_response("Detail with ID '" + payload.id + "' not found.", false);
  
  var rowToUpdate = rowIndex + 2;
  var jenis = sheet.getRange(rowToUpdate, headerMap["Jenis"] + 1).getValue();
  
  if (jenis === 'Cekpoint') {
    sheet.getRange(rowToUpdate, headerMap["Kolum_A"] + 1).setValue(payload.name);
    sheet.getRange(rowToUpdate, headerMap["Kolum_B"] + 1).setValue(payload.location);
    sheet.getRange(rowToUpdate, headerMap["Kolum_C"] + 1).setValue(payload.pic);
    sheet.getRange(rowToUpdate, headerMap["Kolum_D"] + 1).setValue(payload.callSign);
    sheet.getRange(rowToUpdate, headerMap["Kolum_E"] + 1).setValue(payload.crew);
  } else if (jenis === 'Ambulan') {
    sheet.getRange(rowToUpdate, headerMap["Kolum_A"] + 1).setValue(payload.callSign);
    sheet.getRange(rowToUpdate, headerMap["Kolum_B"] + 1).setValue(payload.vehicleNumber);
    sheet.getRange(rowToUpdate, headerMap["Kolum_C"] + 1).setValue(payload.crew);
  } else if (jenis === 'Lain') {
    sheet.getRange(rowToUpdate, headerMap["Kolum_A"] + 1).setValue(payload.title);
    sheet.getRange(rowToUpdate, headerMap["Kolum_B"] + 1).setValue(payload.details);
  }

  var updatedRowValues = sheet.getRange(rowToUpdate, 1, 1, sheet.getLastColumn()).getValues()[0];
  var updatedData = {
      id: updatedRowValues[headerMap.ID_Detail],
      programId: updatedRowValues[headerMap.ID_Program],
      jenis: updatedRowValues[headerMap.Jenis],
      timestamp: updatedRowValues[headerMap.DirekodkanPada],
      name: updatedRowValues[headerMap.Kolum_A],
      location: updatedRowValues[headerMap.Kolum_B],
      pic: updatedRowValues[headerMap.Kolum_C],
      callSign: updatedRowValues[headerMap.Kolum_D],
      crew: updatedRowValues[headerMap.Kolum_E],
      title: updatedRowValues[headerMap.Kolum_A],
      details: updatedRowValues[headerMap.Kolum_B],
      vehicleNumber: updatedRowValues[headerMap.Kolum_B]
  };

  return mecc_response(updatedData);
}


function mecc_addSampleDataToLatestProgram() {
  var programsSheet = mecc_getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!programsSheet || programsSheet.getLastRow() < 2) return mecc_response("No programs found.", false);

  var lastRow = programsSheet.getLastRow();
  var headerMap = mecc_getHeaderMap(programsSheet);
  var idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  var latestProgramId = programsSheet.getRange(lastRow, headerMap[idHeader] + 1).getValue();
  var latestProgramName = programsSheet.getRange(lastRow, headerMap["Nama Program"] + 1).getValue();

  if (!latestProgramId) return mecc_response("Could not get latest program ID.", false);

  var sampleCheckpoints = [ { jenis: 'Cekpoint', programId: latestProgramId, name: 'Pelepasan', location: 'Garis Mula', pic: 'En. Razak', callSign: 'CP-S', crew: 'Team A' } ];
  var sampleAmbulances = [ { jenis: 'Ambulan', programId: latestProgramId, callSign: 'Alpha 1', vehicleNumber: 'VCS 1234', crew: 'Ali, Abu' } ];
  
  try {
    sampleCheckpoints.forEach(function(cp) { mecc_saveProgramDetail(cp); });
    sampleAmbulances.forEach(function(amb) { mecc_saveProgramDetail(amb); });
    return mecc_response({ message: "Sample data added to program: \"" + latestProgramName + "\"." });
  } catch (e) {
    return mecc_response("Failed to add sample data: " + e.message, false);
  }
}

function mecc_saveFeatureListToDocs(payload) {
  var title = payload.title;
  var content = payload.content;
  if (!title || !content) return mecc_response("'title' and 'content' are required.", false);

  try {
    var doc = DocumentApp.create(title);
    var body = doc.getBody();
    content.split('\n').forEach(function(line) {
      if (line.trim() === '') body.appendParagraph('');
      else if (line.startsWith('## ')) body.appendParagraph(line.substring(3)).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      else if (line.startsWith('* ')) body.appendListItem(line.substring(2)).setGlyphType(DocumentApp.GlyphType.BULLET);
      else body.appendParagraph(line);
    });
    doc.saveAndClose();
    return mecc_response({ message: 'Document created.', url: doc.getUrl() });
  } catch (e) {
    return mecc_response("Failed to create Google Doc.", false);
  }
}

function mecc_sendFeedback(payload) {
  // Basic validation
  if (!payload || !payload.feedbackType || !payload.rating || !payload.message) {
    return mecc_response("Payload maklum balas tidak lengkap.", false);
  }

  var TO_ADDRESS = "newgenamz26@gmail.com";
  var subject = "Maklum Balas Sistem MECC AMAL: " + payload.feedbackType;
  
  var ratingStars = '';
  for(var i = 0; i < 5; i++) {
    ratingStars += (i < payload.rating) ? '⭐' : '☆';
  }

  var htmlBody = "<html>" +
    "<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; padding: 20px;'>" +
    "<div style='max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);'>" +
    "<h2 style='color: #0284c7; border-bottom: 2px solid #f0f9ff; padding-bottom: 15px; margin-top: 0;'>Maklum Balas Baru Diterima</h2>" +
    "<p style='margin: 10px 0;'><strong style='color: #4b5563;'>Jenis:</strong> <span style='background-color: #e0f2fe; color: #0c4a6e; padding: 3px 8px; border-radius: 12px; font-size: 14px;'>" + payload.feedbackType + "</span></p>" +
    "<p style='margin: 10px 0;'><strong style='color: #4b5563;'>Penilaian:</strong> <span style='font-size: 18px; color: #f59e0b;'>" + ratingStars + "</span> (" + payload.rating + "/5)</p>" +
    "<p style='margin: 10px 0;'><strong style='color: #4b5563;'>Maklumat Hubungan:</strong> " + (payload.contactInfo || "<em>Tidak diberikan</em>") + "</p>" +
    "<h3 style='color: #0369a1; margin-top: 25px; border-top: 1px solid #f3f4f6; padding-top: 20px;'>Mesej Pengguna:</h3>" +
    "<div style='background-color:#f8fafc; padding:15px; border-radius:8px; border: 1px solid #e2e8f0; white-space: pre-wrap; word-wrap: break-word; font-family: \"Courier New\", monospace; font-size: 14px;'>" + payload.message + "</div>" +
    "<hr style='border: none; border-top: 1px solid #f3f4f6; margin: 25px 0;'>" +
    "<p style='font-size: 12px; color: #64748b; text-align: center;'>E-mel ini dijana secara automatik oleh Sistem MECC AMAL.</p>" +
    "</div>" +
    "</body></html>";
    
  try {
    MailApp.sendEmail({
      to: TO_ADDRESS,
      subject: subject,
      htmlBody: htmlBody,
      noReply: true 
    });
    return mecc_response({ message: "Maklum balas anda telah berjaya dihantar. Terima kasih atas sumbangan anda!" });
  } catch (e) {
    Logger.log("Failed to send feedback email: " + e.message + " | Payload: " + JSON.stringify(payload));
    return mecc_response("Gagal menghantar e-mel maklum balas. Sila cuba lagi kemudian.", false);
  }
}