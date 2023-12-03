import {
  formatProductListJsonObject,
  formatShippingCostJsonObject,
  getQuantityOfProduct,
  lowerAndRemoveSpaces,
  roundFomula,
} from "../shared/utils/Utils.js";

/**
 *
 * @param {object} olJSON dữ liệu file order list
 * @param {object} cogsJSON dữ liệu ban đầu file cogs
 * @param {object} plJSON dữ liệu file product list
 * @param {object} scJSON dữ liệu file shipping cost
 * @returns
 */

export default function getOutputCOGSJson(olJSON, cogsJSON, plJSON, scJSON) {
  const pl = plJSON.map((item) => formatProductListJsonObject(item));
  const sc = formatShippingCostJsonObject(scJSON);

  /**
   * Tính tỷ giá, phí vận chuyển tử holder đến kho và từ kho ra cảng cho từng sản phẩm
   */
  const ol = olJSON.map((item) => {
    const domesticShipType1 = olJSON.find(
      (o) => o["Product Name"]?.match(/"([^']+)"/)?.[1] === item["Product Name"]
    );

    const domesticShipInsideOrder = olJSON.find(
      (o) =>
        o["Product Name"]?.match(/"([^']+)"/)?.[1] === "all" &&
        o["fileOrder"] === item["fileOrder"]
    );

    const domesticShipType2 = !!domesticShipInsideOrder
      ? {
          "Shipping Cost Type": "Domestic Shipping Cost",
          "Total CNY": domesticShipInsideOrder["Total CNY"],
          "Total USD": domesticShipInsideOrder["Total USD"],
          "Shipping Exchange Rate": +Number(
            domesticShipInsideOrder["Total CNY"] /
              domesticShipInsideOrder["Total USD"]
          ).toFixed(4),
          fileOrder: domesticShipInsideOrder["fileOrder"],
        }
      : sc.find((s) => s["Shipping Cost Type"] === "Domestic Shipping Cost");

    return {
      ...item,
      exchangeRate: +Number(item["Total CNY"] / item["Total USD"]).toFixed(4),
      domesticShipType1: domesticShipType1?.["Total CNY"] ?? 0,
      domesticShipType2: domesticShipType2,
    };
  });

  /**
   * Tính tổng đơn vị trong một chuyến
   */
  const totalUnit = cogsJSON.reduce(
    (accumulator, sku) => accumulator + sku["Quantity"],
    0
  );

  /**
   * Thêm trường productList chưa các sản phẩm tương ứng với sku, thông tin lấy từ file Product List
   */
  const cogs = cogsJSON.map((item) => {
    const sku = pl.find((p) => p["SKU"][0] === item.Sku);

    const productLabels = sku["Thành phần PPU"].map((l) => {
      const { quantityInSku, productName } = getQuantityOfProduct(l);
      return {
        quantityInSku: quantityInSku,
        productName: productName,
      };
    });
    const customizePackageCostLabels = sku["Customize Package"];
    const packingAndLabelingLabels = sku["Packing & Labeling"];

    const productList = ol
      .filter(
        (p) =>
          !!productLabels.find(
            (l) =>
              lowerAndRemoveSpaces(l?.productName) ===
              lowerAndRemoveSpaces(p["Product Name"])
          )
      )
      .map((p) => {
        return {
          ...p,
          quantityInSku: productLabels.find(
            (l) =>
              lowerAndRemoveSpaces(l?.productName) ===
              lowerAndRemoveSpaces(p["Product Name"])
          ).quantityInSku,
        };
      });

    const fileOrder = productList[0].fileOrder;

    const customizePackageList = ol.filter(
      (p) =>
        customizePackageCostLabels?.includes(p["Product Name"]) &&
        p.fileOrder === fileOrder
    );
    const packingAndLabelingList = ol.filter(
      (p) =>
        packingAndLabelingLabels?.includes(p["Product Name"]) &&
        p.fileOrder === fileOrder
    );

    return {
      ...item,
      productList: productList,
      ...(!!customizePackageList && {
        customizePackageList: customizePackageList,
      }),
      ...(!!packingAndLabelingList && {
        packingAndLabelingList: packingAndLabelingList,
      }),
    };
  });

  /**
   * Tính ra file COGS cuối cùng để trả về cho client
   */
  const outputCogs = cogs.map((item, index) => {
    const productQuantity = item.productList?.length;

    // cột PPU
    const PPU = item.productList.reduce(
      (accumulator, pr, index) => {
        return {
          t: "n",
          v:
            accumulator.v +
            ((pr["Total CNY"] + pr["domesticShipType1"]) * pr.quantityInSku) /
              (pr["Qty (Pcs)"] * pr.exchangeRate),
          f:
            (index === 0 && productQuantity > 1 ? "(" : "") +
            accumulator.f +
            (pr["domesticShipType1"] === 0 ? "" : "(") +
            `${pr["Total CNY"]}` +
            (pr["domesticShipType1"] === 0 ? "" : "+") +
            `${pr["domesticShipType1"] > 0 ? pr["domesticShipType1"] : ""}` +
            (pr["domesticShipType1"] === 0 ? "" : ")") +
            "/" +
            `${pr["Qty (Pcs)"]}` +
            "*" +
            `${pr.quantityInSku}` +
            (index < item.productList?.length - 1
              ? "+"
              : productQuantity > 1
              ? ")"
              : "") +
            (index === item.productList?.length - 1
              ? `/${pr.exchangeRate}`
              : ""),
        };
      },
      { v: 0, f: "" }
    );

    const customizePackageCost = item.customizePackageList.reduce(
      (accumulator, cpc, index) => {
        return {
          t: "n",
          v: accumulator.v + cpc.Price / cpc.exchangeRate,
          f:
            (index === 0 && item.customizePackageList.length > 1 ? "(" : "") +
            accumulator.f +
            (index === 0 ? "" : "+") +
            `${cpc.Price}` +
            (index < item.customizePackageList?.length - 1
              ? "+"
              : item.customizePackageList.length > 1
              ? ")"
              : "") +
            (index === item.customizePackageList?.length - 1
              ? `/${cpc.exchangeRate}`
              : ""),
        };
      },
      { t: "n", v: 0, f: "" }
    );

    const packingAndLabelingCost = item.packingAndLabelingList.reduce(
      (accumulator, plc) => {
        return {
          t: "n",
          v: accumulator + (plc.Price * productQuantity) / plc.exchangeRate,
          f:
            (index === 0 && item.packingAndLabelingList.length > 1 ? "(" : "") +
            accumulator.f +
            (index === 0 ? "" : "+") +
            `${plc.Price}` +
            (index < item.packingAndLabelingList?.length - 1
              ? "+"
              : item.packingAndLabelingList.length > 1
              ? ")"
              : "") +
            (index === item.packingAndLabelingList?.length - 1
              ? `* ${productQuantity}/${cpc.exchangeRate}`
              : ""),
        };
      },
      { t: "n", v: 0, f: "" }
    );

    // console.log({
    //   sku: item["Sku"],
    //   customizePackageCost: customizePackageCost,
    // });

    // cột phí vận chuyển nội địa
    const domesticScObj = item?.productList[0]?.domesticShipType2;
    const domesticShippingCost = {
      t: "n",
      v: +Number(
        domesticScObj["Total CNY"] /
          domesticScObj["Shipping Exchange Rate"] /
          totalUnit
      ).toFixed(4),
      f: `${domesticScObj["Total CNY"]}/${domesticScObj["Shipping Exchange Rate"]}/${totalUnit}`,
    };

    const internationalScObj = sc.find(
      (s) => s["Shipping Cost Type"] === "Internation Shipping Cost"
    );

    const cogsField = {
      t: "n",
      v: +Number(
        Number(PPU.v) +
          Number(customizePackageCost.v) +
          Number(packingAndLabelingCost.v) +
          Number(domesticShippingCost.v) +
          Number(
            internationalScObj["Total CNY"] /
              internationalScObj["Shipping Exchange Rate"] /
              totalUnit
          )
      ).toFixed(4),
      f: `SUM(D${index + 2}:I${index + 2})`,
    };

    return {
      ["Sku"]: item["Sku"],
      ["Shipment ID"]: item["Shipment ID"],
      ["Quantity"]: item["Quantity"],
      ["PPU"]: { ...PPU, f: PPU.f },
      ["Customize Package Cost"]: !!customizePackageCost.v
        ? { ...customizePackageCost, f: customizePackageCost.f }
        : { t: "n", v: "", f: "" },
      ["Packing & Labeling Cost"]: !!packingAndLabelingCost.v
        ? {
            ...packingAndLabelingCost,
            f: packingAndLabelingCost.f,
          }
        : { t: "n", v: "", f: "" },
      ["Domestic Shipping Cost"]: domesticShippingCost,
      ["International Shipping Cost"]: {
        t: "n",
        v: +Number(
          internationalScObj["Total CNY"] /
            internationalScObj["Shipping Exchange Rate"] /
            totalUnit
        ).toFixed(4),
        f: "",
      },
      ["Payment Cost"]: { t: "n", v: "", f: "" },
      ["COGS"]: cogsField,

      ["Total Units In A Shipment"]: {
        t: "n",
        v: index === 0 ? totalUnit : "",
        f: index === 0 ? `SUM(C${2}:C${cogs.length + 1})` : "",
      },

      ["Amount"]: {
        t: "n",
        v: +Number(cogsField.v * item["Quantity"]).toFixed(4),
        f: `J${index + 2}*C${index + 2}`,
      },
    };
  });

  const totalAmount = outputCogs.reduce(
    (accumulator, sku) => accumulator + sku["Amount"].v,
    0
  );

  const cogsWithTotalAmout = outputCogs.map((item, index) => {
    return {
      ...item,
      ...{
        ["Total Amount"]: {
          t: "n",
          v: index === 0 ? +Number(totalAmount).toFixed(4) : "",
          f: index === 0 ? `SUM(L${2}:L${cogs.length + 1})` : "",
        },
      },
    };
  });

  const headers = Object.keys(cogsWithTotalAmout[0]);

  const output = cogsWithTotalAmout.map((item, index) => {
    return Object.values(item);
  });

  return [headers].concat(output);
}
