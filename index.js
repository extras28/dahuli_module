import XLSX from "xlsx";
import getOutputCOGSJson from "./controllers/getOutputCOGSJson.js";
import { convertJsonToExcel } from "./shared/utils/Utils.js";
import fs from "fs";

const olFile = "./assets/xlsx/Order List - Auto Goods.xlsx";
const plFile = "./assets/xlsx/Product List.xlsx";
const scFile = "./assets/xlsx/Order List - Shipping Cost.xlsx";
const tsvPath = "./assets/xlsx/FBA176X1FK4S.tsv";

const orderFiles = [olFile];

/**
 * parse tsv file to json
 * @param {string} inputFilePath
 * @returns
 */
function tsvToJson(inputFilePath) {
  // Read the TSV file
  const tsvData = fs.readFileSync(inputFilePath, "utf-8");

  // Split the TSV data into rows and columns
  const rows = tsvData.split("\n").map((row) => row.split("\t"));
  const shipmentId = rows[0][1];

  const cogsJson = [];

  for (let i = 0; i < rows.length - 1; i++) {
    if (i > 7) {
      cogsJson.push({
        ["Sku"]: rows[i][0],
        ["Shipment ID"]: shipmentId,
        ["Quantity"]: +rows[i][9],
        ["PPU"]: undefined,
        ["Customize Package Cost"]: undefined,
        ["Packing & Labeling Cost"]: undefined,
        ["Domestic Shipping Cost"]: undefined,
        ["International Shipping Cost"]: undefined,
        ["Payment Cost"]: undefined,
        ["COGS"]: undefined,
        ["Total Units In A Shipment"]: undefined,
        ["Amount"]: undefined,
        ["Total Amount"]: undefined,
      });
    }
  }

  return cogsJson;
}

/**
 * convert xlsx file to json object
 * @param {string} path path to file xlsx
 * @returns
 */
function sheetToJson(path, order = null) {
  // Specify the path to your XLSX file
  const xlsxFilePath = path;

  // Read the XLSX file
  const workbook = XLSX.readFile(xlsxFilePath);

  // Choose the sheet you want to convert to JSON
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert the sheet to JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet);

  if (isNaN(order)) return jsonData;

  return jsonData.map((item) => {
    return { ...item, fileOrder: order + 1 };
  });
}

/**
 * Chuyển đổi dữ liệu từ các file sheet thành JSON
 */
const olJSON = orderFiles.flatMap((item, index) => sheetToJson(item, index));
const cogsJSON = tsvToJson(tsvPath);
const scJSON = sheetToJson(scFile, 0);
const plJSON = sheetToJson(plFile);

// get the final cogs json object
const finalCOGS = getOutputCOGSJson(olJSON, cogsJSON, plJSON, scJSON);

// console.log(finalCOGS);

convertJsonToExcel(finalCOGS, "./outputs/COGS.xlsx");
