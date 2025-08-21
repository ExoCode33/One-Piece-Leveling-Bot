// src/utils/quiz/constants.js - Quiz Constants and Fallback Questions

// Tier colors for embeds
const TIER_COLORS = { 
    1: [255, 255, 255], // Common - White
    2: [76, 175, 80],   // Uncommon - Green  
    3: [33, 150, 243],  // Rare - Blue
    4: [156, 39, 176],  // Epic - Purple
    5: [255, 193, 7],   // Legendary - Yellow
    6: [255, 193, 7],   // Legendary - Yellow
    7: [255, 87, 34],   // Mythic - Orange
    8: [255, 87, 34],   // Mythic - Orange
    9: [255, 20, 20],   // Divine - Red
    10: [255, 20, 20]   // Divine - Red
};

// Tier names
const TIER_NAMES = { 
    1: 'Common', 
    2: 'Uncommon', 
    3: 'Rare', 
    4: 'Epic', 
    5: 'Legendary', 
    6: 'Legendary', 
    7: 'Mythic', 
    8: 'Mythic', 
    9: 'Divine', 
    10: 'Divine' 
};

// Tier descriptions
const TIER_DESC = { 
    1: '⚪ Common boost', 
    2: '🟢 Uncommon power', 
    3: '🔵 Rare ability', 
    4: '🟣 Epic mastery', 
    5: '🟡 Legendary might', 
    6: '🟡 Legendary supremacy', 
    7: '🟠 Mythic transcendence', 
    8: '🟠 Mythic dominance', 
    9: '🔴 Divine ascension', 
    10: '🔴 Divine perfection' 
};

// Fallback anime-only questions organized by difficulty
const ANIME_ONLY_FALLBACK = {
    'Easy': [
        { question: "Who is the main protagonist of One Piece?", options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"], answer: "Monkey D. Luffy" },
        { question: "What is Luffy's Devil Fruit power?", options: ["Rubber", "Fire", "Ice", "Lightning"], answer: "Rubber" },
        { question: "In Naruto, what village is Naruto from?", options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"], answer: "Hidden Leaf Village" },
        { question: "What is the name of Luffy's pirate crew?", options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"], answer: "Straw Hat Pirates" },
        { question: "In My Hero Academia, what is Deku's real name?", options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"], answer: "Izuku Midoriya" },
        { question: "What anime features a notebook that can kill people?", options: ["Death Note", "Code Geass", "Psycho-Pass", "Future Diary"], answer: "Death Note" },
        { question: "In Dragon Ball Z, what is Goku's Saiyan name?", options: ["Kakarot", "Vegeta", "Raditz", "Bardock"], answer: "Kakarot" },
        { question: "What is the name of the main character in Bleach?", options: ["Ichigo Kurosaki", "Rukia Kuchiki", "Uryu Ishida", "Chad Sado"], answer: "Ichigo Kurosaki" },
        { question: "In One Piece, what is Zoro's fighting style?", options: ["Three Sword Style", "Two Sword Style", "One Sword Style", "Four Sword Style"], answer: "Three Sword Style" },
        { question: "In Attack on Titan, what do titans primarily eat?", options: ["Humans", "Animals", "Plants", "Nothing"], answer: "Humans" },
        { question: "In Demon Slayer, what breathing technique does Tanjiro use?", options: ["Water Breathing", "Fire Breathing", "Wind Breathing", "Stone Breathing"], answer: "Water Breathing" },
        { question: "What is the name of the school in My Hero Academia?", options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Isamu Academy"], answer: "U.A. High School" },
        { question: "In Fairy Tail, what is Natsu's magic type?", options: ["Fire Dragon Slayer", "Ice Make", "Celestial Spirit", "Requip"], answer: "Fire Dragon Slayer" },
        { question: "What anime features giant humanoid creatures called Titans?", options: ["Attack on Titan", "Evangelion", "Code Geass", "Gundam"], answer: "Attack on Titan" },
        { question: "In Sailor Moon, what is Usagi's alter ego?", options: ["Sailor Moon", "Sailor Mars", "Sailor Venus", "Sailor Mercury"], answer: "Sailor Moon" },
        { question: "What anime features ninja and is about a boy with a fox spirit?", options: ["Naruto", "Bleach", "One Piece", "Dragon Ball"], answer: "Naruto" },
        { question: "In Dragon Ball, what are the orange orbs called?", options: ["Dragon Balls", "Power Spheres", "Magic Orbs", "Wish Stones"], answer: "Dragon Balls" },
        { question: "What anime is about a boy who can stretch like rubber?", options: ["One Piece", "Naruto", "Bleach", "Dragon Ball"], answer: "One Piece" },
        { question: "In which anime do characters have 'Quirks'?", options: ["My Hero Academia", "Naruto", "One Piece", "Bleach"], answer: "My Hero Academia" },
        { question: "What anime features Soul Reapers?", options: ["Bleach", "Naruto", "One Piece", "Dragon Ball"], answer: "Bleach" }
    ],
    'Medium': [
        { question: "What is the name of the sea where most of One Piece takes place?", options: ["Grand Line", "East Blue", "West Blue", "Red Line"], answer: "Grand Line" },
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "
