import type { Dish } from "./types.js";

/** The 18 breakfast dishes from the family's pruned list. */
export const DISHES: Dish[] = [
  { id: "aloo-paratha", name: { en: "Potato stuffed paratha with curd", hinglish: "Aloo Paratha + Dahi", hi: "आलू पराठा + दही" }, protein: "Medium", season: "All", tags: ["paratha"], weight: 1 },
  { id: "gobhi-paratha", name: { en: "Cauliflower stuffed paratha", hinglish: "Gobhi Paratha", hi: "गोभी पराठा" }, protein: "Medium", season: "All", tags: ["paratha"], weight: 1 },
  { id: "mooli-paratha", name: { en: "Radish stuffed paratha", hinglish: "Mooli Paratha", hi: "मूली पराठा" }, protein: "Medium", season: "Winter", tags: ["paratha"], weight: 1 },
  { id: "missi-paratha", name: { en: "Gram flour and wheat paratha", hinglish: "Missi Paratha", hi: "मिस्सी पराठा" }, protein: "Medium", season: "All", tags: ["paratha"], weight: 1 },
  { id: "paneer-paratha", name: { en: "Cottage cheese stuffed paratha", hinglish: "Paneer Paratha", hi: "पनीर पराठा" }, protein: "High", season: "All", tags: ["paratha", "paneer"], weight: 1 },
  { id: "suji-chilla", name: { en: "Semolina savoury pancake", hinglish: "Suji Chilla", hi: "सूजी चीला" }, protein: "Medium", season: "All", tags: ["chilla"], weight: 1 },
  { id: "besan-chilla", name: { en: "Gram flour savoury pancake", hinglish: "Besan Chilla", hi: "बेसन चीला" }, protein: "High", season: "All", tags: ["chilla"], weight: 1 },
  { id: "moong-dal-chilla", name: { en: "Split moong lentil pancake", hinglish: "Moong Dal Chilla", hi: "मूंग दाल चीला" }, protein: "High", season: "All", tags: ["chilla"], weight: 1 },
  {
    id: "paratha-sabzi",
    name: { en: "Leftover paratha with sabzi", hinglish: "Paratha + Sabzi (raat ka bacha)", hi: "पराठा + सब्ज़ी (रात की बची)" },
    protein: "Low", season: "All", tags: ["paratha", "leftover", "easy"], weight: 1, maxPerWeek: 2,
    notes: "Very common, very easy. Capped at 2 a week.",
  },
  { id: "sprouts-chaat", name: { en: "Sprouts chaat", hinglish: "Sprouts Chaat", hi: "अंकुरित मूंग चाट" }, protein: "High", season: "All", tags: ["salad"], weight: 0.6, occasional: true, notes: "Family doesn't love it, so keep occasional." },
  { id: "poha", name: { en: "Flattened rice with peanuts", hinglish: "Poha with Peanuts", hi: "मूंगफली वाला पोहा" }, protein: "Low", season: "All", tags: ["light", "easy"], weight: 1 },
  { id: "daliya", name: { en: "Vegetable porridge", hinglish: "Vegetable Daliya", hi: "वेज दलिया" }, protein: "Medium", season: "All", tags: ["light"], weight: 1 },
  {
    id: "chole-bhature",
    name: { en: "Chickpea curry with fried bread", hinglish: "Chole Bhature", hi: "छोले भटूरे" },
    protein: "Medium", season: "All", tags: ["treat"], weight: 1, surprise: true, maxPerMonth: 1,
    notes: "Surprise. At most once a month, Sundays only. Cooks see it the day before (chole need soaking).",
  },
  { id: "sandwich", name: { en: "Aloo or paneer sandwich", hinglish: "Aloo / Paneer Sandwich", hi: "आलू / पनीर सैंडविच" }, protein: "Medium", season: "All", tags: ["sandwich", "easy"], weight: 1 },
  { id: "vermicelli", name: { en: "Vermicelli", hinglish: "Vermicelli (Seviyan)", hi: "सेवइयाँ" }, protein: "Medium", season: "All", tags: ["light"], weight: 1 },
  { id: "black-chana-halwa", name: { en: "Black chickpeas with halwa", hinglish: "Kala Chana + Halwa", hi: "काला चना + हलवा" }, protein: "Medium", season: "All", tags: ["traditional"], weight: 0.6, occasional: true },
  { id: "hung-curd-sandwich", name: { en: "Hung curd sandwich", hinglish: "Hung Curd Sandwich", hi: "हंग कर्ड सैंडविच" }, protein: "Medium", season: "All", tags: ["sandwich"], weight: 0.6, occasional: true },
  { id: "pasta", name: { en: "Macaroni or pasta", hinglish: "Macaroni / Pasta", hi: "मैकरोनी / पास्ता" }, protein: "Medium", season: "All", tags: ["pasta"], weight: 0.6, occasional: true },
];
