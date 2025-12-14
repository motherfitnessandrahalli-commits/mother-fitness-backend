const fs = require('fs');
const path = require('path');

// Read the markdown file
const mdPath = path.join(__dirname, '.gemini', 'antigravity', 'brain', '812f2208-9bf7-4de6-87bb-4c0c5589a286', 'walkthrough.md');
const mdContent = fs.readFileSync('C:\\Users\\Vinay\\.gemini\\antigravity\\brain\\812f2208-9bf7-4de6-87bb-4c0c5589a286\\walkthrough.md', 'utf8');

// Create a simple HTML version with styling
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Ultra Fitness Gym - Codebase Walkthrough</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            font-size: 2.5em;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            border-bottom: 2px solid #bdc3c7;
            padding-bottom: 5px;
            font-size: 2em;
        }
        h3 {
            color: #7f8c8d;
            margin-top: 25px;
            font-size: 1.5em;
        }
        h4 {
            color: #95a5a6;
            margin-top: 20px;
            font-size: 1.2em;
        }
        code {
            background: #f7f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #e74c3c;
        }
        pre {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            line-height: 1.4;
        }
        pre code {
            background: none;
            color: #ecf0f1;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            color: #7f8c8d;
            font-style: italic;
            margin: 20px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        ul, ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        li {
            margin: 8px 0;
        }
        hr {
            border: none;
            border-top: 2px solid #bdc3c7;
            margin: 40px 0;
        }
        .mermaid {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        @media print {
            body {
                max-width: 100%;
            }
            h1, h2, h3 {
                page-break-after: avoid;
            }
            pre, table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div id="content"></div>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        const mdContent = ${JSON.stringify(mdContent)};
        document.getElementById('content').innerHTML = marked.parse(mdContent);
    </script>
</body>
</html>
`;

// Write HTML file
const outputPath = path.join(__dirname, 'Ultra-Fitness-Walkthrough.html');
fs.writeFileSync(outputPath, htmlContent);
console.log('✅ HTML file created at:', outputPath);
console.log('📄 Open this file in your browser and use Ctrl+P to save as PDF');
