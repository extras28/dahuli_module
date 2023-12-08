import XLSX from "xlsx";

/**
 *
 * @param {*} inputObj
 * @returns
 */
export function formatProductListJsonObject(inputObj) {
  const outputObj = {};

  let currentKey = null;
  let tempArray = [];

  for (const key in inputObj) {
    if (key.includes("EMPTY")) {
      tempArray.push(inputObj[key]);
    } else {
      if (tempArray.length > 0) {
        outputObj[currentKey] = [inputObj[currentKey]].concat(tempArray);
        tempArray = [];
      }

      outputObj[key] = [inputObj[key]];
      currentKey = key;
    }
  }

  if (tempArray.length > 0) {
    outputObj[currentKey] = tempArray.length === 1 ? tempArray[0] : tempArray;
  } else if (currentKey !== null && !(currentKey in outputObj)) {
    outputObj[currentKey] = inputObj[currentKey];
  }

  return outputObj;
}

/**
 *
 * @param {object} obj
 * @returns
 */
export function formatShippingCostJsonObject(obj) {
  return obj?.map((item) => {
    const shipmentId = item["Product Name"]?.split('"')[1] ?? null;
    let shipmentType = "";

    if (item["Product Name"]?.includes("Internation")) {
      shipmentType = "Internation Shipping Cost";
    } else {
      shipmentType = "Domestic Shipping Cost";
    }

    if (!shipmentId) {
      shipmentType = item["Product Name"] ?? item["Shipping Cost Type"];
    }

    return {
      "Shipping Cost Type": shipmentType,
      shipmentId: shipmentId,
      "Total CNY": item["Total CNY"] ?? 1,
      "Total USD": item["Total USD"] ?? 1,
      "Shipping Exchange Rate": !isNaN(
        Number(item["Total CNY"] / item["Total USD"])
      )
        ? +Number(item["Total CNY"] / item["Total USD"]).toFixed(4)
        : 1,
      fileOrder: item["fileOrder"],
    };
  });
}

/**
 *
 * @param {*} jsonData
 * @param {*} outputFileName
 */
export function convertJsonToExcel(jsonData, outputFileName) {
  // Create a new worksheet starting from the second row
  const worksheet = XLSX.utils.json_to_sheet(jsonData, {
    skipHeader: true,
  });

  const headerStyle = {
    bold: true,
    alignment: { horizontal: "center" },
    fill: {
      fgColor: { rgb: "#92d050" }, // Màu #92d050
    },
  };

  // Loop through cells in the header row and apply the format
  const headerRange = XLSX.utils.decode_range(worksheet["!ref"]);

  // Specify the number format code to display up to 4 decimal places without rounding
  const numberFormatCode = "0.####";

  // Loop through all cells in the worksheet and set the number format code
  for (const cellAddress in worksheet) {
    if (cellAddress[0] === "!") continue; // Skip sheet-level properties

    const cell = worksheet[cellAddress];
    if (
      cell &&
      typeof cell === "object" &&
      typeof cell.v === "number" &&
      cell.v % 1 !== 0
    ) {
      cell.z = numberFormatCode; // Set the number format code for the cell (if it has decimal places)
    }
  }

  // Set column widths and center-align headers
  const colWidths = {};
  // const headerRange = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
    const headerCell = XLSX.utils.encode_cell({ r: headerRange.s.r, c: C });
    const headerText = worksheet[headerCell].v;
    const len = String(headerText).length;
    colWidths[C] = Math.max(len, 10); // Set minimum width to 10
    worksheet[headerCell].s = headerStyle;
  }

  // Adjust column widths to fit content
  jsonData.forEach((row) => {
    Object.keys(row).forEach((key, index) => {
      const len = String(row[key]).length;
      colWidths[index] = Math.max(colWidths[index] || 0, len, 10); // Set minimum width to 10
    });
  });

  worksheet["!cols"] = Object.keys(colWidths).map((index) => ({
    wch: colWidths[index],
  }));

  // Create a new workbook and add the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Write the workbook to a file
  XLSX.writeFile(workbook, outputFileName);

  console.log(`Excel file '${outputFileName}' created successfully!`);
}

/**
 *
 * @param {string} inputString
 * @returns
 */
export function getQuantityOfProduct(inputString) {
  var splitResult = inputString.split(" ");
  var resultPart1 = splitResult[0];
  var resultPart2 = splitResult.slice(1).join(" ");

  if (isNaN(resultPart1)) return { quantityInSku: 1, productName: inputString };

  return { quantityInSku: Number(resultPart1), productName: resultPart2 };
}

/**
 *
 * @param {string} inputString
 * @returns
 */
export function lowerAndRemoveSpaces(inputString) {
  // Convert the string to lowercase
  let lowercasedString = inputString.toLowerCase();

  // Remove spaces from the string
  let stringWithoutSpaces = lowercasedString.replace(/\s/g, "");

  return stringWithoutSpaces;
}

export function roundFomula(fomula) {
  return `ROUND(${fomula}, 4)`;
}
