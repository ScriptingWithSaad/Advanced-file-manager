# Advanced-file-manager
I am creating this project with HTML, CSS, and JavaScript.

Click This Link and Try it Out on the re-imagine page: https://scriptingwithsaad.github.io/Advanced-file-manager/


# Advanced File Manager 📁

A modern, feature-rich web-based file management application with drag-and-drop support, syntax highlighting, and multiple view modes.

## ✨ Features

### Core Functionality
- 📤 **Drag & Drop Upload** - Drag files or entire folders directly into the browser
- 📁 **Folder Support** - Upload and maintain folder structures
- 🔍 **Advanced Search** - Real-time search with highlighting across filenames and content
- 🎨 **Syntax Highlighting** - Automatic code highlighting for 20+ programming languages
- 🌓 **Dark/Light Theme** - Toggle between dark and light modes with persistent preference

### View Modes
- 📋 **List View** - Traditional file list with drag-to-reorder support
- 🌲 **Tree View** - Hierarchical folder structure visualization
- 💻 **Code View** - Generate terminal commands for recreating file structure

### File Operations
- ✏️ **In-line Editing** - Edit filenames and file content directly in the browser
- 📋 **Smart Copy** - Copy filenames, content, or both with one click
- 🗑️ **Batch Operations** - Delete all files or copy all content at once
- 📥 **Export to Markdown** - Export entire project structure as a formatted Markdown file

### Media Support
- 🖼️ **Image Preview** - Built-in image viewer with base64 support
- 🎥 **Video Player** - Embedded video playback
- 🎵 **Audio Player** - Built-in audio file support
- 📄 **HTML Preview** - Render HTML files in sandboxed iframes

### Advanced Features
- 🔄 **Relative/Absolute Paths** - Toggle between path display modes
- 📊 **File Statistics** - Real-time file count and total size tracking
- ⚡ **Performance Optimized** - Handles large numbers of files efficiently
- 💾 **Memory Management** - Automatic cleanup and memory optimization
- 🛡️ **Error Handling** - Comprehensive error handling with user-friendly messages

## 🚀 Quick Start


Open index.html in a modern web browser (Chrome, Firefox, Safari, Edge)
No build process or dependencies required! It's a pure vanilla JavaScript application.

Usage
Upload Files:

Click the upload area or drag files/folders directly
Use "Select Files" or "Select Folder" buttons
Search Files:

Type in the search bar to find files by name or content
Use Enter/Shift+Enter to navigate between matches
Switch Views:

Click view buttons to switch between List, Tree, and Code views
Edit Files:

Click the edit icon to modify filenames or content
Changes are saved automatically when you click outside
🛠️ Technical Details
Technologies Used
Frontend: Pure HTML5, CSS3, JavaScript (ES6+)
Syntax Highlighting: Prism.js
Icons: Font Awesome 6.4.0
No Backend Required: Runs entirely in the browser
Browser Compatibility
Chrome 90+
Firefox 88+
Safari 14+
Edge 90+
File Type Support
Text Files: .txt, .md, .log
Code Files: .js, .ts, .jsx, .tsx, .py, .java, .cpp, .c, .php, .rb, .go, .sql
Web Files: .html, .css, .scss, .json, .xml
Media Files: .jpg, .png, .gif, .svg, .mp4, .mp3, .wav
Documents: .pdf, .doc, .docx
Performance
Optimized for handling 1000+ files
Lazy loading for large file contents
Virtual scrolling for tree view (planned)
Debounced search for smooth performance
📁 Project Structure
code
Copy code
advanced-file-manager/
├── index.html          # Main HTML file
├── styles.css         # All styling
├── script.js          # Core JavaScript logic
└── README.md          # This file
code
Copy code
🔧 Configuration
File Size Limits
By default, the maximum file size is 50MB. You can modify this in script.js:

javascript
Copy code
const maxFileSize = 50 * 1024 * 1024; // 50MB limit
javascript
Copy code
Supported File Types
Add or remove file types in the allowedTypes Set in handleFileSelect() method.

🎨 Customization
Themes
The application supports custom color schemes. Modify CSS variables in :root and body.dark-theme selectors.

Icons
File icons are mapped in the getFileIcon() method. Add custom icons for specific file types.

🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

Development Guidelines
Maintain vanilla JavaScript (no frameworks)
Follow existing code style
Test in multiple browsers
Update documentation for new features
📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
Prism.js for syntax highlighting
Font Awesome for icons
Inspired by modern file management needs
📮 Contact
For questions or suggestions, please open an issue on GitHub.

Made with ❤️ by Scripting With Saad
