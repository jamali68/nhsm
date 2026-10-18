const fs = require('fs');

global.window = global;
global.window.addEventListener = () => {};
global.firebase = {
  apps: [{ name: "default" }],
  auth: () => ({ onAuthStateChanged: () => {} }),
  firestore: () => ({ collection: () => ({ doc: () => ({}) }) })
};
global.db = {
  collection: () => ({
    where: () => ({ get: () => Promise.resolve([]) }),
    doc: () => ({})
  }),
  batch: () => ({ commit: () => Promise.resolve(), set: () => {} })
};
global.auth = { onAuthStateChanged: () => {} };

let elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      style: {},
      classList: { add: ()=>{}, remove: ()=>{}, contains: ()=>false },
      innerText: "",
      value: "0",
      children: [],
      appendChild: function(c) { this.children.push(c); },
      querySelector: function() { return { value: "0", innerText: "", dataset: {}, style: {} }; },
      querySelectorAll: function() { return []; },
      addEventListener: function(){}
    };
  }
  return elements[id];
}
global.document = {
  getElementById: getEl,
  querySelector: () => ({ style: {}, scrollIntoView: ()=>{} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.localStorage = { getItem: () => null, setItem: () => null };
global.Swal = { fire: (o) => console.log("Swal fire:", o) };

// Load bills.js
require('./public/bills.js');

global.allMyStock = [
  { id: "stk_1", name: "Cadbury Big Creamy", rate: 50, wholesaleRate: 45, qty: 100 },
  { id: "stk_2", name: "Eclairs", rate: 10, wholesaleRate: 8, qty: 50 },
  { id: "stk_3", name: "Milkees", rate: 20, wholesaleRate: 18, qty: 75 }
];
global.selectedCustomer = { id: "c1", name: "Imtiaz Ali", balance: 0, customerType: "retail" };
global.myUser = { role: "booker", name: "Staff" };

console.log("Calling renderInteractiveProductList()...");
global.renderInteractiveProductList();
console.log("HTML length:", getEl("interactiveProductsContainer").innerHTML.length);
console.log("Has tokari-btn?", getEl("interactiveProductsContainer").innerHTML.includes("list-tokari-btn"));

console.log("Calling bookListItem('stk_1', 1)...");
global.bookListItem("stk_1", 1);
console.log("catCart keys:", Object.keys(global.catCart));
console.log("After booking has list-counter-box?", getEl("interactiveProductsContainer").innerHTML.includes("list-counter-box"));
console.log("After booking has minus button?", getEl("interactiveProductsContainer").innerHTML.includes("list-counter-btn minus"));
console.log("Calling decrementListItem('stk_1')...");
global.decrementListItem("stk_1");
console.log("After decrement has tokari-btn again?", getEl("interactiveProductsContainer").innerHTML.includes("list-tokari-btn"));
