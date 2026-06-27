import { getChatReply } from "./src/lib/chatEngine";
const routes = [
  ["New Delhi", "IGI Airport"],
  ["Dwarka Sector - 21", "New Delhi"],
  ["Huda City Centre", "Rajiv Chowk"],
  ["Noida Electronic City", "Dwarka Sector - 21"],
  ["Rajiv Chowk", "Kashmere Gate"],
  ["New Delhi", "Shivaji Stadium"],
  ["Dwarka Sector - 21", "Aerocity"],
];
for (const [a, b] of routes) {
  console.log(`${a} -> ${b}:`, getChatReply(`fare from ${a} to ${b}`).text);
}
