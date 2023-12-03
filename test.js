const outputArray = [
  [...Object.keys(data[0]), "Score", "Total", "Amount"],
  ...data.map((item, index) => {
    const ageTimes2 = { t: "n", f: `${item.Age}*2` };
    const total = {
      t: "n",
      //   v: item.Age + item.Total,
      f: `SUM(B${index + 2}:C${index + 2})`,
    };
    const amount =
      index === 0
        ? { t: "n", f: `SUM(D${index + 2}:D${data.length + 1})` }
        : "";

    return [...Object.values(item), ageTimes2, total, amount];
  }),
];

// const exampleOutputArray = [
//   ["Name", "Age", "Score"],
//   ["John", 25, { t: "n", v: 50, f: "25*2" }],
//   ["Alice", 30, { t: "n", v: 60, f: "30*2" }],
//   ["Bob", 28, { t: "n", v: 56, f: "28*2" }],
// ];

// Create a new worksheet starting from the second row
const worksheet = XLSX.utils.json_to_sheet(outputArray, {
  skipHeader: true,
});

// Create a new workbook and add the worksheet
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

// Write the workbook to a file
XLSX.writeFile(workbook, "./outputs/example_with_formula.xlsx");
