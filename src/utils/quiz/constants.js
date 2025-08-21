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
        { question: "In Attack on Titan, what is Eren's Titan form called?", options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"], answer: "Attack Titan" },
        { question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?", options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"], answer: "Levi Ackerman" },
        { question: "In Demon Slayer, what is Tanjiro's family name?", options: ["Kamado", "Hashibira", "Agatsuma", "Shinazugawa"], answer: "Kamado" },
        { question: "In Fullmetal Alchemist, what do the Elric brothers seek?", options: ["Philosopher's Stone", "Dragon Balls", "Death Note", "Holy Grail"], answer: "Philosopher's Stone" },
        { question: "In One Punch Man, what is Saitama's hero rank initially?", options: ["Class C", "Class B", "Class A", "Class S"], answer: "Class C" },
        { question: "In Jujutsu Kaisen, what grade is Yuji Itadori initially classified as?", options: ["Grade 4", "Grade 3", "Grade 2", "Grade 1"], answer: "Grade 4" },
        { question: "In One Piece, what is the name of the World Government's secret police?", options: ["CP9", "Marines", "Shichibukai", "Revolutionaries"], answer: "CP9" },
        { question: "In Tokyo Ghoul, what are the creatures that eat humans called?", options: ["Ghouls", "Titans", "Demons", "Hollows"], answer: "Ghouls" },
        { question: "In Mob Psycho 100, what percentage does Mob reach for an explosion?", options: ["100%", "200%", "150%", "300%"], answer: "100%" },
        { question: "In Hunter x Hunter, what is the name of the hunter exam arc?", options: ["Hunter Exam", "Yorknew City", "Greed Island", "Chimera Ant"], answer: "Hunter Exam" },
        { question: "In Seven Deadly Sins, what is Meliodas' sin?", options: ["Wrath", "Pride", "Greed", "Envy"], answer: "Wrath" },
        { question: "In Fire Force, what are the fire-powered beings called?", options: ["Infernals", "Pyromancers", "Fire Demons", "Flame Spirits"], answer: "Infernals" },
        { question: "In Dr. Stone, what petrified humanity?", options: ["Green Light", "Meteor", "Virus", "Magic"], answer: "Green Light" },
        { question: "In Assassination Classroom, what is Koro-sensei?", options: ["Octopus-like creature", "Human", "Robot", "Alien"], answer: "Octopus-like creature" },
        { question: "In Black Clover, what is Asta's main trait?", options: ["No magic", "Fire magic", "Wind magic", "Water magic"], answer: "No magic" },
        { question: "In Haikyuu, what sport do they play?", options: ["Volleyball", "Basketball", "Soccer", "Tennis"], answer: "Volleyball" },
        { question: "In Food Wars, what is the main character's name?", options: ["Soma Yukihira", "Erina Nakiri", "Takumi Aldini", "Ryo Kurokiba"], answer: "Soma Yukihira" },
        { question: "In One Piece, what are Devil Fruit users unable to do?", options: ["Swim", "Fight", "Eat", "Sleep"], answer: "Swim" },
        { question: "In Chainsaw Man, what is Denji's goal?", options: ["Touch boobs", "Become strongest", "Save world", "Find love"], answer: "Touch boobs" }
    ],
    'Hard': [
        { question: "In One Piece, where do the Straw Hats first meet Brook?", options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"], answer: "Thriller Bark" },
        { question: "What is Roy Mustang's title in Fullmetal Alchemist?", options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"], answer: "Flame Alchemist" },
        { question: "In Hunter x Hunter, what is Gon's father's name?", options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"], answer: "Ging Freecss" },
        { question: "What is the name of the school in Kill la Kill?", options: ["Honnouji Academy", "Kiryuin Academy", "Satsuki Academy", "Ryuko Academy"], answer: "Honnouji Academy" },
        { question: "In Jojo's Bizarre Adventure, what is Dio's stand called?", options: ["The World", "Star Platinum", "Crazy Diamond", "Gold Experience"], answer: "The World" },
        { question: "In Code Geass, what is Lelouch's Geass power?", options: ["Absolute Obedience", "Mind Reading", "Time Stop", "Precognition"], answer: "Absolute Obedience" },
        { question: "What is the name of Light's Shinigami in Death Note?", options: ["Ryuk", "Rem", "Misa", "Near"], answer: "Ryuk" },
        { question: "In Evangelion, what is the name of Shinji's father?", options: ["Gendo Ikari", "Ryoji Kaji", "Kozo Fuyutsuki", "Shigeru Aoba"], answer: "Gendo Ikari" },
        { question: "What is the real name of the character known as 'L' in Death Note?", options: ["L Lawliet", "Near", "Mello", "Watari"], answer: "L Lawliet" },
        { question: "In One Piece, what is the name of the ancient weapons?", options: ["Pluton, Poseidon, Uranus", "Zeus, Hera, Poseidon", "Ares, Athena, Apollo", "Thor, Odin, Loki"], answer: "Pluton, Poseidon, Uranus" },
        { question: "What is the name of the organization that Lelouch leads in Code Geass?", options: ["Black Knights", "White Fang", "Blue Cosmos", "Red Frame"], answer: "Black Knights" },
        { question: "In Steins;Gate, what is the name of the time machine?", options: ["Phone Microwave", "Time Machine", "D-Mail", "SERN"], answer: "Phone Microwave" },
        { question: "In Cowboy Bebop, what is the name of Spike's ship?", options: ["Swordfish II", "Hammerhead", "Redtail", "Bebop"], answer: "Swordfish II" },
        { question: "In Fate/Stay Night, what class is Saber?", options: ["Saber", "Archer", "Lancer", "Rider"], answer: "Saber" },
        { question: "In Overlord, what is Ainz Ooal Gown's real name?", options: ["Momonga", "Suzuki Satoru", "Ulbert", "Touch Me"], answer: "Momonga" },
        { question: "In Monster, who is the main antagonist?", options: ["Johan Liebert", "Nina Fortner", "Wolfgang Grimmer", "Roberto"], answer: "Johan Liebert" },
        { question: "In Parasyte, what is the name of Shinichi's parasite?", options: ["Migi", "Reiko", "Gotou", "Tamiya"], answer: "Migi" },
        { question: "In Berserk, what is the name of Guts' sword?", options: ["Dragon Slayer", "Iron Reaver", "Demon Blade", "God Hand"], answer: "Dragon Slayer" },
        { question: "In Yu Yu Hakusho, what is Yusuke's spirit detective rank?", options: ["E-Class", "D-Class", "C-Class", "B-Class"], answer: "E-Class" },
        { question: "In Trigun, what is Vash's nickname?", options: ["Humanoid Typhoon", "Stampede", "Plant", "Gunslinger"], answer: "Humanoid Typhoon" }
    ]
};

// API endpoints for fetching questions
const ANIME_APIS = [
    {
        name: 'OpenTDB',
        url: 'https://opentdb.com/api.php?amount=3&category=31&type=multiple&difficulty=easy',
        parser: 'opentdb'
    },
    {
        name: 'The Trivia API',
        url: 'https://the-trivia-api.com/v2/questions?categories=anime_and_manga&limit=5',
        parser: 'trivia-api'
    }
];

// Question quality filters
const QUESTION_FILTERS = {
    // Keywords that should be avoided in questions
    badKeywords: [
        'studio that animated', 'animation studio', 'produced by', 'directed by',
        'composed by', 'music by', 'soundtrack by', 'opening theme', 'ending theme',
        'manga author', 'mangaka', 'light novel author', 'creator of',
        'published by', 'serialized in', 'magazine', 'publisher',
        'network that aired', 'broadcast on', 'streaming platform',
        'budget', 'box office', 'sales figures', 'episode count of',
        'animation technique', 'art style', 'animation quality'
    ],
    
    // Patterns that are acceptable even with bad keywords
    allowedPatterns: [
        'year.*air', 'when.*air', 'what year.*release',
        'voice.*actor', 'voiced by', 'seiyuu', 'dub.*actor',
        'original.*air', 'first.*broadcast', 'premiere'
    ],
    
    // Keywords that indicate anime content
    animeKeywords: [
        'anime', 'manga', 'character', 'protagonist', 'antagonist',
        'power', 'ability', 'technique', 'jutsu', 'devil fruit',
        'titan', 'demon', 'soul reaper', 'ninja', 'pirate',
        'hero', 'villain', 'quirk', 'stand', 'magic',
        'guild', 'crew', 'team', 'squad', 'organization'
    ]
};

// Known anime titles for content validation
const KNOWN_ANIME_TITLES = [
    'naruto', 'one piece', 'bleach', 'dragon ball', 'attack on titan',
    'my hero academia', 'demon slayer', 'jujutsu kaisen', 'hunter x hunter',
    'fullmetal alchemist', 'death note', 'code geass', 'evangelion',
    'cowboy bebop', 'akira', 'spirited away', 'totoro', 'princess mononoke',
    'sailor moon', 'pokemon', 'digimon', 'yu-gi-oh', 'one punch man',
    'mob psycho', 'tokyo ghoul', 'parasyte', 'berserk', 'trigun',
    'fairy tail', 'black clover', 'fire force', 'chainsaw man',
    'assassination classroom', 'haikyuu', 'kuroko', 'food wars',
    'seven deadly sins', 'overlord', 're:zero', 'konosuba',
    'shield hero', 'slime', 'goblin slayer', 'made in abyss'
];

// Question difficulty configuration
const DIFFICULTY_CONFIG = {
    Easy: {
        weight: 2,    // 2 out of 10 questions
        description: 'Basic anime knowledge',
        targetSuccess: 90
    },
    Medium: {
        weight: 4,    // 4 out of 10 questions
        description: 'Intermediate anime knowledge',
        targetSuccess: 70
    },
    Hard: {
        weight: 4,    // 4 out of 10 questions
        description: 'Advanced anime knowledge',
        targetSuccess: 40
    }
};

// XP rewards configuration
const XP_REWARDS = {
    correctAnswer: parseInt(process.env.DAILY_QUIZ_CORRECT_ANSWER_XP) || 500,
    completionBonus: parseInt(process.env.DAILY_QUIZ_COMPLETION_BONUS) || 1000,
    perfectScore: parseInt(process.env.DAILY_QUIZ_PERFECT_SCORE_BONUS) || 2000
};

// Timing configuration
const TIMING_CONFIG = {
    questionTime: 20,        // 20 seconds per question
    revealTime: 5,           // 5 seconds to show answer
    continueTime: 15,        // 15 seconds to decide continue/secure
    preloadTimeout: 5000,    // 5 seconds to preload questions
    apiTimeout: 5000         // 5 seconds per API call
};

module.exports = {
    TIER_COLORS,
    TIER_NAMES,
    TIER_DESC,
    ANIME_ONLY_FALLBACK,
    ANIME_APIS,
    QUESTION_FILTERS,
    KNOWN_ANIME_TITLES,
    DIFFICULTY_CONFIG,
    XP_REWARDS,
    TIMING_CONFIG
};
