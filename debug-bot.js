// debug-bot.js - Run this to find and fix syntax errors

const fs = require('fs');
const path = require('path');

// Function to validate JavaScript syntax
function validateJSFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for basic syntax issues
        const issues = [];
        
        // Count brackets
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;
        
        if (openBraces !== closeBraces) {
            issues.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
        }
        if (openParens !== closeParens) {
            issues.push(`Mismatched parentheses: ${openParens} open, ${closeParens} close`);
        }
        if (openBrackets !== closeBrackets) {
            issues.push(`Mismatched brackets: ${openBrackets} open, ${closeBrackets} close`);
        }
        
        // Check for incomplete strings
        const singleQuotes = (content.match(/'/g) || []).length;
        const doubleQuotes = (content.match(/"/g) || []).length;
        const backticks = (content.match(/`/g) || []).length;
        
        if (singleQuotes % 2 !== 0) {
            issues.push(`Unmatched single quotes`);
        }
        if (doubleQuotes % 2 !== 0) {
            issues.push(`Unmatched double quotes`);
        }
        if (backticks % 2 !== 0) {
            issues.push(`Unmatched backticks`);
        }
        
        // Try to eval the syntax (dangerous but useful for debugging)
        try {
            require('vm').createScript(content);
        } catch (syntaxError) {
            issues.push(`Syntax error: ${syntaxError.message}`);
        }
        
        return { valid: issues.length === 0, issues };
        
    } catch (error) {
        return { valid: false, issues: [`File read error: ${error.message}`] };
    }
}

// Main debug function
function debugBot() {
    console.log('🔍 DISCORD BOT SYNTAX DEBUGGER');
    console.log('===============================\n');
    
    const commandsDir = './src/commands';
    const indexFile = './index.js';
    
    // Check if commands directory exists
    if (!fs.existsSync(commandsDir)) {
        console.log('❌ Commands directory not found!');
        return;
    }
    
    // Get all JavaScript files in commands directory
    const commandFiles = fs.readdirSync(commandsDir)
        .filter(file => file.endsWith('.js'));
    
    console.log(`📁 Found ${commandFiles.length} command files\n`);
    
    let hasErrors = false;
    
    // Check each command file
    for (const file of commandFiles) {
        const filePath = path.join(commandsDir, file);
        console.log(`🔍 Checking: ${file}`);
        
        const result = validateJSFile(filePath);
        
        if (result.valid) {
            console.log(`✅ ${file} - No syntax errors found`);
        } else {
            console.log(`❌ ${file} - ERRORS FOUND:`);
            result.issues.forEach(issue => {
                console.log(`   - ${issue}`);
            });
            hasErrors = true;
        }
        console.log('');
    }
    
    // Check main index.js file
    if (fs.existsSync(indexFile)) {
        console.log(`🔍 Checking: index.js`);
        const result = validateJSFile(indexFile);
        
        if (result.valid) {
            console.log(`✅ index.js - No syntax errors found`);
        } else {
            console.log(`❌ index.js - ERRORS FOUND:`);
            result.issues.forEach(issue => {
                console.log(`   - ${issue}`);
            });
            hasErrors = true;
        }
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (hasErrors) {
        console.log('❌ ISSUES FOUND! Recommended actions:');
        console.log('1. Replace daily-quiz.js with the minimal version provided');
        console.log('2. Check for missing closing brackets } in other files');
        console.log('3. Use VS Code with JavaScript support for better error detection');
        console.log('4. Restart your bot after fixing syntax errors');
    } else {
        console.log('✅ All files passed syntax validation!');
        console.log('If you\'re still getting errors, try:');
        console.log('1. Restarting your Node.js process');
        console.log('2. Clearing Node.js cache: rm -rf node_modules && npm install');
        console.log('3. Checking your Node.js version: node --version');
    }
}

// Run the debugger
debugBot();
