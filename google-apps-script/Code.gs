// Set this to your Spreadsheet ID.
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";

/*******************************************************
 * HIGHLIGHT: Centralized sheet name configuration
 *******************************************************/
const SHEET_NAMES = {
  PROGRAMS: 'Programs',
  ATTENDANCE: 'Attendance',
  RESPONDERS: 'Responders',
  CASE_REPORTS: 'CaseReports'
};

const SSid = SpreadsheetApp.openById(SPREADSHEET_ID);

const SUPPORTED_GET_ACTIONS = [
  "ping", 
  "getPrograms", 
  "getDashboard", 
  "getNewProgramId", 
  "getLatestProgram", 
  "validateSheets",
  "getConfig"
];

/**
 * Creates a standard JSON response object for the web app.
 * @param {any} data - The payload to send.
 * @param {boolean} [success=true] - Whether the operation was successful.
 * @returns {GoogleAppsScript.Content.TextOutput} - The JSON response.
 */
function response(data, success = true) {
  const output = JSON.stringify({
    success: success,
    data: data
  });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Gets a map of header names to their 0-based column indices.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to process.
 * @returns {Object.<string, number>} A map of header names to indices.
 */
function getHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, i) => {
    map[header.trim()] = i;
  });
  return map;
}

/**
 * Checks if the Programs sheet has any data rows.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The Programs sheet.
 * @returns {boolean} True if there are no program data entries.
 */
function _isProgramsSheetEmpty(sheet) {
  // A sheet with only a header row (or less) is considered empty of data.
  return sheet.getLastRow() < 2;
}

/**
 * Generates the next sequential program ID for the current day.
 * Format: YYYYMMDD-XXXX (e.g., 20240118-0001)
 * This is an internal helper function.
 * @returns {string} The newly generated program ID.
 */
function _generateNextProgramId() {
  const sheet = SSid.getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) throw new Error(`Sheet '${SHEET_NAMES.PROGRAMS}' not found`);

  const today = new Date();
  const year = today.getFullYear().toString();
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const day = ('0' + today.getDate()).slice(-2);
  const prefix = year + month + day;

  // Use the new helper function to check if we need to start with 0001.
  if (_isProgramsSheetEmpty(sheet)) {
    return prefix + "-0001";
  }

  const headerMap = getHeaderMap(sheet);
  const idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  const idColIndex = headerMap[idHeader];

  if (idColIndex === undefined) {
    throw new Error(`ID column ('ID Program' or 'id') not found in sheet '${SHEET_NAMES.PROGRAMS}'.`);
  }
  const idColumn = idColIndex + 1; // 1-based index for getRange

  const allIds = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues().flat();
  
  const todaysIds = allIds.filter(id => id && id.toString().startsWith(prefix));
  
  let maxCounter = 0;
  todaysIds.forEach(id => {
    const parts = id.toString().split('-');
    if (parts.length === 2) {
      const counterStr = parts[1];
      const counter = parseInt(counterStr, 10);
      if (!isNaN(counter) && counter > maxCounter) {
        maxCounter = counter;
      }
    }
  });

  const nextCounter = maxCounter + 1;
  const nextCounterPadded = ('0000' + nextCounter).slice(-4);

  return prefix + "-" + nextCounterPadded;
}


/*******************************************************
 * HIGHLIGHT: NEW CODE FOR SHEET STRUCTURE VALIDATION
 *******************************************************/

/**
 * A helper function to validate the structure of a specific sheet.
 * It checks for the existence of the sheet and its required columns.
 * This is an internal function, called by the validateSheets endpoint.
 * @param {string} sheetName The name of the sheet to validate (e.g., "Programs", "Attendance").
 * @returns {{isValid: boolean, message: string, details?: {missing: string[], found: string[]}}} An object with the validation result.
 */
function _validateSheetStructure(sheetName) {
  const sheet = SSid.getSheetByName(sheetName);
  if (!sheet) {
    return { 
      isValid: false, 
      message: `Sheet '${sheetName}' not found.`
    };
  }
  
  const headerMap = getHeaderMap(sheet);
  const actualHeaders = Object.keys(headerMap);
  let missing = [];

  // Define required columns for each sheet type
  if (sheetName === SHEET_NAMES.PROGRAMS) {
    if (!headerMap.hasOwnProperty("ID Program") && !headerMap.hasOwnProperty("id")) {
      missing.push("ID Program (or id)");
    }
    if(!headerMap.hasOwnProperty("Nama Program")) {
      missing.push("Nama Program");
    }
  } else if (sheetName === SHEET_NAMES.ATTENDANCE) {
     if(!headerMap.hasOwnProperty("Nama Responder")) {
      missing.push("Nama Responder");
    }
    if(!headerMap.hasOwnProperty("Mula Tugas")) {
      missing.push("Mula Tugas");
    }
  } else {
    // Validation is not configured for other sheets, so we consider them valid by default.
    return { isValid: true, message: `Validation not configured for sheet '${sheetName}'.` };
  }

  // If there are missing columns, return a detailed error message.
  if (missing.length > 0) {
    return {
      isValid: false,
      message: `Missing required columns: ${missing.join(', ')}.`,
      details: { missing: missing, found: actualHeaders }
    };
  }

  // If all checks pass, return a success message.
  return { 
    isValid: true, 
    message: `Sheet has the required headers.`,
    details: { missing: [], found: actualHeaders }
  };
}


/**
 * Web app endpoint to validate the structure of key Google Sheets.
 * Calls the helper function for each sheet and returns a combined result.
 */
function validateSheets() {
  const programsResult = _validateSheetStructure(SHEET_NAMES.PROGRAMS);
  const attendanceResult = _validateSheetStructure(SHEET_NAMES.ATTENDANCE);

  const results = {
    programs: programsResult,
    attendance: attendanceResult
  };
  
  // Return the structured results. The client-side will interpret the isValid flags.
  return response(results, true);
}

/*******************************************************
 * END OF HIGHLIGHTED CODE
 *******************************************************/


/**
 * === GET HANDLER ===
 * Handles all GET requests to the web app.
 * HIGHLIGHT: Enhanced with detailed logging for easier debugging.
 */
function doGet(e) {
  const params = e.parameter;
  Logger.log("doGet Start. Received parameters: " + JSON.stringify(params));

  // More robust check for the 'type' parameter.
  if (!params.hasOwnProperty('type') || !params.type || String(params.type).trim() === '') {
    Logger.log("Error: 'type' parameter is missing, empty, or null. Parameters: " + JSON.stringify(params));
    return response("Parameter 'type' diperlukan.", false);
  }
  
  const type = String(params.type).trim();
  Logger.log("Processing type: '" + type + "'");

  try {
    switch (type) {
      case "ping":
        Logger.log("Executing action: ping");
        return response("pong");
      case "getPrograms":
        Logger.log("Executing action: getPrograms");
        return getPrograms();
      case "getAttendance":
      case "getDashboard":
        Logger.log("Executing action: getDashboard/getAttendance");
        return getDashboard();
      case "getNewProgramId":
        Logger.log("Executing action: getNewProgramId");
        return response(_generateNextProgramId());
      case "getLatestProgram":
        Logger.log("Executing action: getLatestProgram");
        return getLatestProgram();
      case "validateSheets":
        Logger.log("Executing action: validateSheets");
        return validateSheets();
      case "getConfig":
        Logger.log("Executing action: getConfig");
        return response({ actions: SUPPORTED_GET_ACTIONS, sheetNames: SHEET_NAMES });
      default:
        Logger.log("Error: Unknown action type '" + type + "'");
        const errorResponse = response("Action GET tidak dikenali: " + type, false);
        return errorResponse;
    }
  } catch (error) {
    Logger.log("Error caught in doGet for type '" + type + "': " + error.message);
    Logger.log("Error stack: " + error.stack);
    return response("Error in doGet: " + error.message, false);
  }
}


/**
 * === POST HANDLER ===
 * Handles all POST requests (currently for saving programs).
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'saveProgram') {
      return saveProgram(body.payload);
    } else {
      return response('Action POST tidak dikenali: ' + action, false);
    }
  } catch (error) {
    return response("Error in doPost: " + error.message, false);
  }
}


// --- App-specific functions ---

/**
 * Fetches the list of programs, robust to column order.
 */
function getPrograms() {
  const sheet = SSid.getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) return response(`Sheet '${SHEET_NAMES.PROGRAMS}' not found`, false);
  if (sheet.getLastRow() < 2) return response([]);

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headerMap = getHeaderMap(sheet);
  
  const idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
  
  const idIndex = headerMap[idHeader];
  const nameIndex = headerMap["Nama Program"];
  const dateIndex = headerMap["Tarikh"];
  const timeIndex = headerMap["Masa"];
  const locationIndex = headerMap["Lokasi"];
  const lockedIndex = headerMap["Locked"];

  if (idIndex === undefined || nameIndex === undefined) {
    return response(`Required columns ('${idHeader}', 'Nama Program') not found in '${SHEET_NAMES.PROGRAMS}' sheet.`, false);
  }

  const result = data.map(r => ({
    id: r[idIndex],
    namaprogram: r[nameIndex],
    tarikh: r[dateIndex],
    masa: r[timeIndex],
    lokasi: r[locationIndex],
    locked: r[lockedIndex]
  })).filter(p => p.id && p.namaprogram);
  return response(result);
}

/**
 * Fetches the latest program from the "Programs" sheet, robust to column order.
 */
function getLatestProgram() {
  const sheet = SSid.getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) return response(`Sheet '${SHEET_NAMES.PROGRAMS}' not found`, false);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return response("Tiada program ditemui", false);
  }
  
  const headerMap = getHeaderMap(sheet);
  const idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";

  const idIndex = headerMap[idHeader];
  const nameIndex = headerMap["Nama Program"];

  if (idIndex === undefined || nameIndex === undefined) {
    return response(`Required columns ('${idHeader}', 'Nama Program') not found in '${SHEET_NAMES.PROGRAMS}' sheet.`, false);
  }

  const data = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const latestProgram = {
    id: data[idIndex],
    namaprogram: data[nameIndex]
  };
  
  return response(latestProgram);
}


/**
 * Fetches attendance data for the dashboard, robust to column order.
 */
function getDashboard() {
  const sheet = SSid.getSheetByName(SHEET_NAMES.ATTENDANCE);
  if (!sheet) return response(`Sheet '${SHEET_NAMES.ATTENDANCE}' not found. Please create it or check for typos.`, false);

  if (sheet.getLastRow() < 2) return response([]); // No data besides header

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headerMap = getHeaderMap(sheet);
  
  const nameIndex = headerMap["Nama Responder"];
  const startIndex = headerMap["Mula Tugas"];
  const endIndex = headerMap["Tamat Tugas"];
  const caseIndex = headerMap["Jumlah Kes"];
  
  if (nameIndex === undefined || startIndex === undefined) {
      return response(`Required columns 'Nama Responder' and 'Mula Tugas' not found in '${SHEET_NAMES.ATTENDANCE}' sheet.`, false);
  }

  const result = data.map(r => ({
    nama: r[nameIndex],
    mula: r[startIndex],
    tamat: r[endIndex] !== undefined ? r[endIndex] || null : null,
    kes: caseIndex !== undefined ? r[caseIndex] || 0 : 0
  })).filter(att => att.nama); // Filter out rows where 'nama' is empty.
  
  return response(result);
}

/**
 * Saves a new program, robust to column order. ID is generated on the server.
 */
function saveProgram(payload) {
    const sheet = SSid.getSheetByName(SHEET_NAMES.PROGRAMS);
    if (!sheet) return response(`Sheet '${SHEET_NAMES.PROGRAMS}' not found`, false);
    
    const newId = _generateNextProgramId();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = new Array(headers.length);

    const idHeader = headers.includes("ID Program") ? "ID Program" : "id";
    
    // Map client payload to sheet header names
    const rowData = {
      [idHeader]: newId,
      "Nama Program": payload.name,
      "Tarikh": payload.date,
      "Masa": payload.time,
      "Lokasi": payload.location,
      "Last Update": new Date(),
      "Locked": false
    };

    // Build the row array in the correct order based on headers
    headers.forEach((header, i) => {
        const trimmedHeader = header.trim();
        newRow[i] = rowData.hasOwnProperty(trimmedHeader) ? rowData[trimmedHeader] : "";
    });
    
    sheet.appendRow(newRow);

    const newProgramData = { id: newId, namaprogram: payload.name };
    return response({ message: "Program saved successfully", newProgram: newProgramData });
}

/**
 * FOR TESTING: Checks the last program ID and logs what the next one will be.
 * Run this function manually from the Apps Script editor.
 */
function checkAndLogNextId() {
  const sheet = SSid.getSheetByName(SHEET_NAMES.PROGRAMS);
  if (!sheet) {
    Logger.log(`Sheet '${SHEET_NAMES.PROGRAMS}' not found.`);
    return;
  }

  if (_isProgramsSheetEmpty(sheet)) {
    Logger.log("No existing programs found in the sheet.");
  } else {
    const headerMap = getHeaderMap(sheet);
    const idHeader = headerMap.hasOwnProperty("ID Program") ? "ID Program" : "id";
    const idColIndex = headerMap[idHeader];
    
    if (idColIndex === undefined) {
      Logger.log("Could not find the ID column.");
      return;
    }
    
    const idColumn = idColIndex + 1; // 1-based index for getRange
    const lastRow = sheet.getLastRow();
    const lastId = sheet.getRange(lastRow, idColumn).getValue();
    Logger.log("Latest existing program ID: " + lastId);
  }

  const nextId = _generateNextProgramId();
  Logger.log("Next ID to be used: " + nextId);
}