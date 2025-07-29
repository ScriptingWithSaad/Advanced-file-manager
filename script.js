class AdvancedFileManager {
  constructor() {
    this.files = [];
    this.isProcessing = false;
    this.processingQueue = [];
    this.maxConcurrentOperations = 3;
    this.toastTimeout = null;
    this.searchDebounceTimeout = null;
    this.searchDebounceDelay = 300;
    this.currentView = "list";
    this.useRelativePaths = true;
    this.searchTerm = "";
    this.maxFileSize = Infinity; // No file size limit
    this.supportedFileTypes = new Set([
      "text/plain",
      "text/html",
      "text/css",
      "text/javascript",
      "text/json",
      "application/json",
      "application/javascript",
      "text/markdown",
      "text/xml",
      "application/xml",
      "text/csv",
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/svg+xml",
      "image/webp",
      // Videos
      "video/mp4",
      "video/webm",
      "video/ogg",
      // Audio
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/mpeg",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    try {
      this.initializeElements();
      this.bindEvents();
      this.updateStats();
    } catch (error) {
      this.handleError("Failed to initialize file manager", error);
    }
  }
  handleError(message, error, showRetry = false) {
    console.error(message, error);

    // Log detailed error info for debugging
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
      console.error("Error name:", error.name);
    }

    // Show user-friendly error message
    const userMessage = this.getUserFriendlyErrorMessage(message, error);
    this.showToast(userMessage, "error", showRetry);

    // Track error for analytics (if needed)
    this.trackError(message, error);
  }

  getUserFriendlyErrorMessage(message, error) {
    // Map technical errors to user-friendly messages
    const errorMappings = {
      NetworkError:
        "Network connection issue. Please check your internet connection.",
      QuotaExceededError: "Storage quota exceeded. Please free up some space.",
      NotAllowedError:
        "Permission denied. Please allow the required permissions.",
      SecurityError: "Security error. This operation is not allowed.",
      TypeError: "Invalid data format. Please check your input.",
      ReferenceError: "Application error. Please refresh the page.",
    };

    if (error instanceof Error) {
      return errorMappings[error.name] || message;
    }

    return message;
  }

  trackError(message, error) {
    // Simple error tracking - can be extended
    try {
      const errorData = {
        message,
        error: error?.message || "Unknown error",
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Store in localStorage for debugging (limit to last 10 errors)
      const errors = JSON.parse(
        localStorage.getItem("fileManagerErrors") || "[]"
      );
      errors.unshift(errorData);
      errors.splice(10); // Keep only last 10 errors
      localStorage.setItem("fileManagerErrors", JSON.stringify(errors));
    } catch (trackingError) {
      console.warn("Error tracking failed:", trackingError);
    }
  }

  initializeElements() {
    try {
      // Main elements
      this.uploadArea = this.getElement("uploadArea");
      this.fileInput = this.getElement("fileInput");
      this.folderInput = this.getElement("folderInput");
      this.filesContainer = this.getElement("filesContainer");
      this.searchInput = this.getElement("searchInput");
      this.themeToggle = this.getElement("themeToggle");

      // View controls
      this.listViewBtn = this.getElement("listViewBtn");
      this.treeViewBtn = this.getElement("treeViewBtn");
      this.codeViewBtn = this.getElement("codeViewBtn");

      // Action buttons
      this.selectFilesBtn = this.getElement("selectFilesBtn");
      this.selectFolderBtn = this.getElement("selectFolderBtn");
      this.copyAllBtn = this.getElement("copyAllBtn");
      this.deleteAllBtn = this.getElement("deleteAllBtn");
      this.relativePathToggle = this.getElement("relativePathToggle");

      // Stats elements
      this.fileCount = this.getElement("fileCount");
      this.totalSize = this.getElement("totalSize");
      this.toast = this.getElement("toast");

      // Search navigation elements
      this.searchNav = this.getElement("searchNav");
      this.searchCount = this.getElement("searchCount");
      this.prevMatchBtn = this.getElement("prevMatch");
      this.nextMatchBtn = this.getElement("nextMatch");

      this.clearSearchBtn = this.getElement("clearSearch");

      // Export element
      this.exportBtn = this.getElement("exportBtn");

      // Progress and modal elements
      this.progressBar = this.getElement("progressBar");
      this.confirmModal = this.getElement("confirmModal");

      // Search state
      this.searchMatches = [];
      this.currentMatchIndex = 0;

      // File management state
      this.selectedFiles = new Set();
      this.sortBy = "name";
      this.sortOrder = "asc";
      this.fileHistory = [];
      this.undoStack = [];
      this.redoStack = [];
    } catch (error) {
      throw new Error(`Failed to initialize UI elements: ${error.message}`);
    }
  }

  getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required element with ID '${id}' not found in DOM`);
    }
    return element;
  }

  bindEvents() {
    try {
      // Remove existing event listeners first to prevent duplicates
      if (this.eventListeners) {
        this.eventListeners.forEach(({ element, event, handler }) => {
          element.removeEventListener(event, handler);
        });
      }
      this.eventListeners = [];

      // Create bound methods to avoid conflicts
      this.handleFileInputChange = (e) => {
        try {
          this.handleFileSelect(e.target.files);
          e.target.value = ''; // Clear input to allow same file selection
        } catch (error) {
          this.handleError("Failed to process selected files", error);
        }
      };

      this.handleFolderInputChange = (e) => {
        try {
          this.handleFileSelect(e.target.files);
          e.target.value = ''; // Clear input to allow same folder selection
        } catch (error) {
          this.handleError("Failed to process selected folder", error);
        }
      };

      // File input events - attach once
      this.fileInput.addEventListener("change", this.handleFileInputChange);
      this.folderInput.addEventListener("change", this.handleFolderInputChange);
      
      // Store listeners for cleanup
      this.eventListeners.push(
        { element: this.fileInput, event: "change", handler: this.handleFileInputChange },
        { element: this.folderInput, event: "change", handler: this.handleFolderInputChange }
      );

      // File upload button events
      const fileSelectHandler = (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          this.fileInput.click();
        } catch (error) {
          this.handleError("Failed to open file selector", error);
        }
      };

      const folderSelectHandler = (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          this.folderInput.click();
        } catch (error) {
          this.handleError("Failed to open folder selector", error);
        }
      };

      this.selectFilesBtn.addEventListener("click", fileSelectHandler);
      this.selectFolderBtn.addEventListener("click", folderSelectHandler);
      
      // Store these listeners too
      this.eventListeners.push(
        { element: this.selectFilesBtn, event: "click", handler: fileSelectHandler },
        { element: this.selectFolderBtn, event: "click", handler: folderSelectHandler }
      );

      // Drag and drop events with error handling
      const dragOverHandler = this.handleDragOver.bind(this);
      const dropHandler = this.handleDrop.bind(this);
      const dragLeaveHandler = (e) => {
        this.uploadArea.classList.remove("drag-over");
      };
      
      this.uploadArea.addEventListener("dragover", dragOverHandler);
      this.uploadArea.addEventListener("drop", dropHandler);
      this.uploadArea.addEventListener("dragleave", dragLeaveHandler);
      
      // Store drag listeners
      this.eventListeners.push(
        { element: this.uploadArea, event: "dragover", handler: dragOverHandler },
        { element: this.uploadArea, event: "drop", handler: dropHandler },
        { element: this.uploadArea, event: "dragleave", handler: dragLeaveHandler }
      );
      this.uploadArea.addEventListener("click", (e) => {
        try {
          if (
            e.target === this.uploadArea ||
            e.target.classList.contains("upload-content") ||
            e.target.classList.contains("upload-icon") ||
            e.target.tagName === "H3" ||
            e.target.tagName === "P"
          ) {
            e.preventDefault();
            e.stopPropagation();
            this.fileInput.click();
          }
        } catch (error) {
          this.handleError("Failed to handle upload area click", error);
        }
      });

      // View control events
      this.listViewBtn.addEventListener("click", () =>
        this.safeViewSwitch("list")
      );
      this.treeViewBtn.addEventListener("click", () =>
        this.safeViewSwitch("tree")
      );
      this.codeViewBtn.addEventListener("click", () =>
        this.safeViewSwitch("code")
      );

      // Action button events with error handling
      this.copyAllBtn.addEventListener("click", () => this.safeCopyAllFiles());
      this.deleteAllBtn.addEventListener("click", () =>
        this.safeDeleteAllFiles()
      );
      this.relativePathToggle.addEventListener("change", () =>
        this.safeToggleRelativePaths()
      );

      // Search functionality with error handling
      this.searchInput.addEventListener("input", (e) =>
        this.safeHandleSearch(e)
      );
      this.searchInput.addEventListener("keydown", (e) =>
        this.safeHandleSearchKeydown(e)
      );
      this.prevMatchBtn.addEventListener("click", () =>
        this.safeNavigateSearch("prev")
      );
      this.nextMatchBtn.addEventListener("click", () =>
        this.safeNavigateSearch("next")
      );

      this.clearSearchBtn.addEventListener("click", () =>
        this.safeClearSearch()
      );

      // Export event
      this.exportBtn.addEventListener("click", () => this.safeExportFiles());

      // Global keyboard shortcuts
      document.addEventListener("keydown", (e) =>
        this.safeHandleGlobalKeyboard(e)
      );

      // Theme toggle with error handling
      this.themeToggle.addEventListener("click", () => this.safeToggleTheme());
    } catch (error) {
      this.handleError("Failed to bind event listeners", error);
    }
  }

  // Safe wrapper methods for event handlers
  safeViewSwitch(view) {
    try {
      this.switchView(view);
    } catch (error) {
      this.handleError(`Failed to switch to ${view} view`, error);
    }
  }

  safeCopyAllFiles() {
    try {
      this.copyAllFiles();
    } catch (error) {
      this.handleError("Failed to copy all files", error);
    }
  }

  safeDeleteAllFiles() {
    try {
      this.deleteAllFiles();
    } catch (error) {
      this.handleError("Failed to delete all files", error);
    }
  }

  safeToggleRelativePaths() {
    try {
      this.toggleRelativePaths();
    } catch (error) {
      this.handleError("Failed to toggle path display", error);
    }
  }

  safeHandleSearch(e) {
    try {
      this.handleSearch(e);
    } catch (error) {
      this.handleError("Search failed", error);
    }
  }

  safeHandleSearchKeydown(e) {
    try {
      this.handleSearchKeydown(e);
    } catch (error) {
      this.handleError("Search navigation failed", error);
    }
  }

  safeNavigateSearch(direction) {
    try {
      this.navigateSearch(direction);
    } catch (error) {
      this.handleError("Search navigation failed", error);
    }
  }

  safeToggleTheme() {
    try {
      this.toggleTheme();
    } catch (error) {
      this.handleError("Failed to toggle theme", error);
    }
  }

  safeClearSearch() {
    try {
      this.clearSearch();
    } catch (error) {
      this.handleError("Failed to clear search", error);
    }
  }

  safeExportFiles() {
    try {
      this.exportFiles();
    } catch (error) {
      this.handleError("Failed to export files", error);
    }
  }

  safeHandleGlobalKeyboard(e) {
    try {
      this.handleGlobalKeyboard(e);
    } catch (error) {
      this.handleError("Keyboard shortcut failed", error);
    }
  }

  async handleFileSelect(files) {
    if (!files || files.length === 0) {
      this.showToast("No files selected", "warning");
      return;
    }

    if (this.isProcessing) {
      this.showToast("Please wait, still processing previous files", "warning");
      return;
    }

    console.log("Starting file selection process with", files.length, "files");

    this.isProcessing = true;
    let progressInfo = null;

    try {
      // Initialize progress tracking
      progressInfo = {
        total: files.length,
        processed: 0,
        errors: 0,
        startTime: Date.now(),
      };

      this.showLoadingOverlay("Validating files...");

      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      const allowedTypes = new Set([
        "text/plain",
        "text/html",
        "text/css",
        "text/javascript",
        "application/json",
        "text/markdown",
        "text/xml",
        "text/csv",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/svg+xml",
        "video/mp4",
        "audio/mp3",
        "application/pdf",
      ]);

      const fileArray = Array.from(files);
      const validFiles = [];
      const errors = [];

      // Enhanced validation with better error messages
      for (const file of fileArray) {
        try {
          // Check file size
          if (file.size === 0) {
            errors.push(`${file.name}: Empty file`);
            continue;
          }

          if (file.size > maxFileSize) {
            errors.push(
              `${file.name}: File too large (${this.formatFileSize(
                file.size
              )}, max 50MB)`
            );
            continue;
          }

          // Check file type
          if (!allowedTypes.has(file.type) && !this.isTextFile(file.name)) {
            errors.push(
              `${file.name}: Unsupported file type (${file.type || "unknown"})`
            );
            continue;
          }

          // Check for duplicates with better comparison
          const isDuplicate = this.files.some(
            (f) =>
              f.name === file.name &&
              f.size === file.size &&
              Math.abs(f.lastModified - file.lastModified) < 1000
          );

          if (isDuplicate) {
            errors.push(`${file.name}: File already exists`);
            continue;
          }

          // Check filename validity
          const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
          if (invalidChars.test(file.name)) {
            errors.push(`${file.name}: Invalid characters in filename`);
            continue;
          }

          validFiles.push(file);
        } catch (error) {
          errors.push(`${file.name}: ${error.message || "Validation error"}`);
          console.error("File validation error:", error);
        }
      }

      // Enhanced error reporting
      if (errors.length > 0) {
        // Count duplicate files specifically
        const duplicateCount = errors.filter((err) =>
          err.includes("File already exists")
        ).length;
        const otherErrorsCount = errors.length - duplicateCount;

        let errorMessage = "";

        // Create user-friendly summary
        if (duplicateCount > 0 && otherErrorsCount === 0) {
          // Only duplicates
          errorMessage = `⚠️ <span class="math-inline" data-latex="%7BduplicateCount%7D%20duplicate%20file">{duplicateCount} duplicate file</span>{duplicateCount > 1 ? 's' : ''} skipped`;
        } else if (duplicateCount > 0 && otherErrorsCount > 0) {
          // Mixed errors
          errorMessage = `⚠️ <span class="math-inline" data-latex="%7BduplicateCount%7D%20duplicate">{duplicateCount} duplicate</span>{duplicateCount > 1 ? 's' : ''} and <span class="math-inline" data-latex="%7BotherErrorsCount%7D%20invalid%20file">{otherErrorsCount} invalid file</span>{otherErrorsCount > 1 ? 's' : ''} skipped`;
        } else {
          // Only other errors
          errorMessage = `⚠️ <span class="math-inline" data-latex="%7Berrors.length%7D%20file">{errors.length} file</span>{errors.length > 1 ? 's' : ''} skipped`;
        }

        // Add details for non-duplicate errors
        if (otherErrorsCount > 0 || errors.length <= 3) {
          errorMessage += "\n\n";
          const maxErrorsToShow = 5;
          const errorsToShow = errors
            .filter(
              (err) =>
                !err.includes("File already exists") || errors.length <= 3
            )
            .slice(0, maxErrorsToShow);

          errorMessage += errorsToShow.map((err) => `• ${err}`).join("\n");

          if (errors.length > maxErrorsToShow) {
            errorMessage += `\n• ... and ${
              errors.length - maxErrorsToShow
            } more`;
          }
        }

        this.showToast(errorMessage, "warning", 6000);
      }

      if (validFiles.length === 0) {
        // Don't show "No valid files to process" if we already showed a specific error message
        if (errors.length === 0) {
          this.showToast("No valid files to process", "warning");
        }
        this.isProcessing = false;
        this.hideLoadingOverlay();
        return;
      }

      // Update progress info
      progressInfo.total = validFiles.length;
      this.updateLoadingProgress(0, validFiles.length, "Processing files...");

      // Process files synchronously to avoid overwhelming the browser
      const processedFiles = [];
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        try {
          const fileObj = await this.processFileAsync(file);
          processedFiles.push(fileObj);
          progressInfo.processed++;

          // Update progress
          const percentage = Math.round((progressInfo.processed / progressInfo.total) * 100);
          this.updateLoadingProgress(
            progressInfo.processed,
            progressInfo.total,
            `Processing ${file.name} (${percentage}%)`
          );
          
          // Small delay to prevent UI blocking
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } catch (error) {
          progressInfo.errors++;
          console.error(`Error processing file ${file.name}:`, error);
        }
      }


      // Final results
      const processingTime = (
        (Date.now() - progressInfo.startTime) /
        1000
      ).toFixed(1);

      if (progressInfo.processed > 0) {
        this.renderFiles();
        this.updateStats();

        const successMessage =
          progressInfo.errors > 0
            ? `✅ Processed ${progressInfo.processed} files (${progressInfo.errors} failed) in ${processingTime}s`
            : `✅ Successfully processed ${progressInfo.processed} files in ${processingTime}s`;

        this.showToast(successMessage, "success");
      }

      if (progressInfo.errors > 0 && progressInfo.processed === 0) {
        this.showToast(
          `❌ Failed to process all ${progressInfo.errors} files`,
          "error"
        );
      }
    } catch (error) {
      console.error("Critical error in handleFileSelect:", error);
      this.handleError("Critical error during file processing", error);
    } finally {
      this.isProcessing = false;
      this.hideLoadingOverlay();

      // Clear any temporary data
      if (progressInfo) {
        progressInfo = null;
      }
    }
  }

  isTextFile(filename) {
    const textExtensions = [
      ".txt",
      ".md",
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".css",
      ".scss",
      ".html",
      ".xml",
      ".json",
      ".yaml",
      ".yml",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".php",
      ".rb",
      ".go",
      ".sql",
      ".sh",
    ];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return textExtensions.includes(ext);
  }

  async processFileAsync(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error("File processing timeout"));
      }, 30000); // 30 second timeout

      reader.onload = (e) => {
        clearTimeout(timeout);
        try {
          const fileObj = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            lastModified: file.lastModified,
            relativePath: file.relativePath || file.name,
            content: e.target.result,
            isImage:
              file.type.startsWith("image/") && !file.name.endsWith(".svg"),
            isVideo: file.type.startsWith("video/"),
            isAudio: file.type.startsWith("audio/"),
            isBinary: this.isBinaryFile(file.type),
            isHTML: file.name.endsWith(".html") || file.name.endsWith(".htm"),
            addedAt: Date.now(),
            status: "processed",
          };

          this.files.push(fileObj);
          resolve(fileObj);
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to read file: ${file.name}`));
      };

      reader.onabort = () => {
        clearTimeout(timeout);
        reject(new Error(`File reading aborted: ${file.name}`));
      };

      try {
        if (
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          file.type.startsWith("audio/")
        ) {
          reader.readAsDataURL(file);
        } else if (this.isBinaryFile(file.type)) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  validateFile(file) {
    if (!file) {
      this.showToast("Invalid file object", "error");
      return false;
    }

    // Check if file already exists
    if (this.files.some((f) => f.name === file.name && f.size === file.size)) {
      this.showToast(`File "${file.name}" already exists`, "warning");
      return false;
    }

    return true;
  }

  handleDragOver(e) {
    try {
      e.preventDefault();
      this.uploadArea.classList.add("drag-over");
    } catch (error) {
      this.handleError("Drag over handler failed", error);
    }
  }

  handleDrop(e) {
    try {
      e.preventDefault();
      this.uploadArea.classList.remove("drag-over");

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) {
        this.showToast("No files dropped", "warning");
        return;
      }

      // Check if already processing
      if (this.isProcessing) {
        this.showToast("Please wait, still processing previous files", "warning");
        return;
      }

      // Show processing indicator for drag and drop
      this.isProcessing = true;
      this.showLoadingOverlay("Processing dropped files...");

      const filesToProcess = [];

      // Collect files first, then process them together
      const promises = Array.from(items).map((item) => {
        return new Promise((resolve) => {
          try {
            if (item.kind === "file") {
              const entry = item.webkitGetAsEntry();
              if (entry) {
                this.collectEntryFiles(entry, resolve);
              } else {
                // Fallback for browsers that don't support webkitGetAsEntry
                const file = item.getAsFile();
                if (file) {
                  resolve([file]);
                } else {
                  resolve([]);
                }
              }
            } else {
              resolve([]);
            }
          } catch (error) {
            console.error("Error processing dropped item:", error);
            resolve([]);
          }
        });
      });

      // Wait for all files to be collected, then process them
      Promise.all(promises).then((fileArrays) => {
        const allFiles = fileArrays.flat();
        this.isProcessing = false;
        this.hideLoadingOverlay();
        if (allFiles.length > 0) {
          this.handleFileSelect(allFiles);
        } else {
          this.showToast("No valid files found", "warning");
        }
      }).catch((error) => {
    this.isProcessing = false;
    this.hideLoadingOverlay();
    console.error("Error collecting dropped files:", error);
    this.showToast("Failed to process dropped files", "error");
  });
    } catch (error) {
      this.handleError("Failed to handle dropped files", error);
    }
  }

  collectEntryFiles(entry, callback, path = "") {
    const files = [];
    
    if (entry.isFile) {
      entry.file(
        (file) => {
          try {
            file.relativePath = path + entry.name;
            files.push(file);
            callback(files);
          } catch (error) {
            console.error("Error processing file from entry:", error);
            callback([]);
          }
        },
        (error) => {
          console.error("Error reading file from entry:", error);
          callback([]);
        }
      );
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      this.readAllEntriesForCollection(dirReader, path + entry.name + "/", callback);
    } else {
      callback([]);
    }
  }

  readAllEntriesForCollection(dirReader, path, callback) {
    const allFiles = [];
    
    const readEntries = () => {
      dirReader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            callback(allFiles);
            return;
          }

          const promises = entries.map((entry) => {
            return new Promise((resolve) => {
              this.collectEntryFiles(entry, resolve, path);
            });
          });

          Promise.all(promises).then((fileArrays) => {
            allFiles.push(...fileArrays.flat());
            readEntries(); // Continue reading
          }).catch((error) => {
            console.error("Error reading directory entries:", error);
            callback(allFiles);
          });
        },
        (error) => {
          console.error("Error reading directory:", error);
          callback(allFiles);
        }
      );
    };

    readEntries();
  }

  processEntry(entry, path = "") {
    if (!entry) {
      console.warn("Invalid entry provided to processEntry");
      return;
    }

    try {
      if (entry.isFile) {
        entry.file(
          (file) => {
            try {
              file.relativePath = path + entry.name;
              if (this.validateFile(file)) {
                this.processFile(file);
              }
            } catch (error) {
              console.error("Error processing file from entry:", error);
              this.showToast(`Error processing file: ${entry.name}`, "error");
            }
          },
          (error) => {
            console.error("Error reading file from entry:", error);
            this.showToast(`Error reading file: ${entry.name}`, "error");
          }
        );
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        this.readAllEntries(dirReader, path + entry.name + "/");
      }
    } catch (error) {
      console.error("Error in processEntry:", error);
      this.showToast(`Error processing entry: ${entry.name}`, "error");
    }
  }

  readAllEntries(dirReader, path) {
    if (!dirReader) {
      console.error("Invalid directory reader");
      return;
    }

    try {
      dirReader.readEntries(
        (entries) => {
          try {
            if (entries.length > 0) {
              entries.forEach((entry) => {
                this.processEntry(entry, path);
              });
              // Continue reading if there are more entries
              this.readAllEntries(dirReader, path);
            }
          } catch (error) {
            console.error("Error processing directory entries:", error);
            this.showToast("Error processing directory contents", "error");
          }
        },
        (error) => {
          console.error("Error reading directory:", error);
          this.showToast("Error reading directory", "error");
        }
      );
    } catch (error) {
      console.error("Error in readAllEntries:", error);
      this.showToast("Error reading directory structure", "error");
    }
  }

  clearSearch() {
    this.searchInput.value = "";
    this.searchTerm = "";
    this.searchMatches = [];
    this.currentMatchIndex = 0;
    this.searchNav.style.display = "none";
    this.renderFiles();
    this.showToast("Search cleared");
  }

  exportFiles() {
    if (this.files.length === 0) {
      this.showToast("No files to export", "warning");
      return;
    }

    let markdownContent = `# File Manager Export\n\n`;
    markdownContent += `**Export Date:** ${new Date().toLocaleString()}\n`;
    markdownContent += `**Total Files:** ${this.files.length}\n\n`;
    markdownContent += `---\n\n`;

    this.files.forEach((file, index) => {
      const displayName = this.useRelativePaths ? file.relativePath : file.name;
      markdownContent += `## ${index + 1}. ${displayName}\n\n`;

      if (file.isBinary || file.isImage || file.isVideo || file.isAudio) {
        markdownContent += `**File Type:** ${file.type}\n`;
        markdownContent += `**Size:** ${this.formatFileSize(file.size)}\n`;
        markdownContent += `*[Binary/Media file - content not displayed]*\n\n`;
      } else {
        markdownContent += `**File Type:** ${file.type}\n`;
        markdownContent += `**Size:** ${this.formatFileSize(file.size)}\n\n`;

        // Determine language for code block
        const ext = file.name.split(".").pop().toLowerCase();
        const language = this.getLanguageFromFilename(file.name);

        markdownContent += `\`\`\`${language}\n`;
        markdownContent += file.content || "";
        markdownContent += `\n\`\`\`\n\n`;
      }

      markdownContent += `---\n\n`;
    });

    const blob = new Blob([markdownContent], {
      type: "text/markdown",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `file-manager-export-${
      new Date().toISOString().split("T")[0]
    }.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(
      `Exported ${this.files.length} files as Markdown`,
      "success"
    );
  }

  handleGlobalKeyboard(e) {
    // Escape key - clear search or close modals
    if (e.key === "Escape") {
      if (this.searchTerm) {
        e.preventDefault();
        this.clearSearch();
      }
      if (this.confirmModal.style.display !== "none") {
        this.hideConfirmModal();
      }
    }

    // Ctrl/Cmd + S - Export files
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      this.exportFiles();
    }

    // Ctrl/Cmd + A - Select all files (if in list view)
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key === "a" &&
      this.currentView === "list"
    ) {
      e.preventDefault();
      this.selectAllFiles();
    }

    // Delete key - delete selected files
    if (e.key === "Delete" && this.selectedFiles.size > 0) {
      e.preventDefault();
      this.deleteSelectedFiles();
    }
  }

  showProgressBar() {
    this.progressBar.style.display = "block";
  }

  updateProgressBar(percentage, text = "Processing...") {
    const fill = this.progressBar.querySelector(".progress-fill");
    const textEl = this.progressBar.querySelector(".progress-text");

    if (fill) fill.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = text;
  }

  hideProgressBar() {
    this.progressBar.style.display = "none";
  }

  showConfirmModal(title, message, onConfirm) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;

    this.confirmModal.style.display = "flex";

    const confirmOk = document.getElementById("confirmOk");
    const confirmCancel = document.getElementById("confirmCancel");

    // Remove existing listeners
    confirmOk.replaceWith(confirmOk.cloneNode(true));
    confirmCancel.replaceWith(confirmCancel.cloneNode(true));

    const newOk = document.getElementById("confirmOk");
    const newCancel = document.getElementById("confirmCancel");

    newOk.addEventListener("click", () => {
      this.hideConfirmModal();
      onConfirm();
    });

    newCancel.addEventListener("click", () => {
      this.hideConfirmModal();
    });
  }

  hideConfirmModal() {
    this.confirmModal.style.display = "none";
  }

  selectAllFiles() {
    if (this.files.length === 0) return;

    this.selectedFiles.clear();
    this.files.forEach((file) => this.selectedFiles.add(file.id));
    this.renderFiles();
    this.showToast(`Selected ${this.files.length} files`);
  }

  deleteSelectedFiles() {
    if (this.selectedFiles.size === 0) return;

    this.showConfirmModal(
      "Delete Selected Files",
      `Are you sure you want to delete ${this.selectedFiles.size} selected file(s)?`,
      () => {
        const selectedIds = Array.from(this.selectedFiles);
        this.files = this.files.filter(
          (file) => !selectedIds.includes(file.id)
        );
        this.selectedFiles.clear();
        this.renderFiles();
        this.updateStats();
        this.showToast(`Deleted ${selectedIds.length} files`);
      }
    );
  }

  processFile(file) {
    if (!file) {
      console.error("No file provided to processFile");
      return;
    }

    console.log("Processing file:", file.name, "Size:", file.size);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target || !e.target.result) {
          throw new Error("FileReader returned invalid result");
        }

        const fileObj = {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified,
          relativePath: file.relativePath || file.name,
          content: e.target.result,
          isImage:
            file.type.startsWith("image/") && !file.name.endsWith(".svg"),
          isVideo: file.type.startsWith("video/"),
          isAudio: file.type.startsWith("audio/"),
          isBinary: this.isBinaryFile(file.type),
          isHTML: file.name.endsWith(".html") || file.name.endsWith(".htm"),
        };

        this.files.push(fileObj);
        // Add status for new files
        fileObj.status = "new";
        fileObj.addedAt = Date.now();
        console.log("File added to array. Total files:", this.files.length);
        this.renderFiles();
        this.updateStats();
        this.showToast(`Added: ${fileObj.name}`, "success");
      } catch (error) {
        console.error("Error creating file object:", error);
        this.showToast(`Failed to process: ${file.name}`, "error");
      }
    };

    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      this.showToast(`Failed to read file: ${file.name}`, "error");
    };

    reader.onabort = () => {
      console.warn("FileReader aborted for:", file.name);
      this.showToast(`File reading was aborted: ${file.name}`, "warning");
    };

    try {
      // Handle different file types
      if (
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/")
      ) {
        reader.readAsDataURL(file);
      } else if (this.isBinaryFile(file.type)) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    } catch (error) {
      console.error("Error starting file read:", error);
      this.showToast(`Failed to start reading: ${file.name}`, "error");
    }
  }

  isBinaryFile(type) {
    if (!type) return false;

    const binaryTypes = [
      "application/pdf",
      "application/zip",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ];
    return binaryTypes.includes(type) || type.includes("binary");
  }

  switchView(view) {
    if (!["list", "tree", "code"].includes(view)) {
      throw new Error(`Invalid view type: ${view}`);
    }

    try {
      this.currentView = view;

      // Update active button
      const buttons = document.querySelectorAll(".view-btn");
      if (buttons.length === 0) {
        throw new Error("View buttons not found");
      }

      buttons.forEach((btn) => btn.classList.remove("active"));

      const activeButton = document.getElementById(`${view}ViewBtn`);
      if (!activeButton) {
        throw new Error(`Button for ${view} view not found`);
      }

      activeButton.classList.add("active");
      this.renderFiles();
    } catch (error) {
      throw new Error(`Failed to switch view: ${error.message}`);
    }
  }

  toggleRelativePaths() {
    try {
      this.useRelativePaths = this.relativePathToggle.checked;
      this.renderFiles();
    } catch (error) {
      throw new Error(`Failed to toggle relative paths: ${error.message}`);
    }
  }

  handleSearch(e) {
    try {
      const searchValue = e.target.value.toLowerCase();

      // Clear existing debounce timeout
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout);
      }

      // Show loading state for search
      if (searchValue && searchValue.length > 2) {
        this.searchNav.style.display = "flex";
        this.searchCount.textContent = "Searching...";
      }

      // Debounce search execution
      this.searchDebounceTimeout = setTimeout(() => {
        this.searchTerm = searchValue;
        this.searchMatches = [];
        this.currentMatchIndex = 0;

        if (this.searchTerm) {
          this.findAllMatches();
          this.updateSearchNav();
          this.searchNav.style.display = "flex";
        } else {
          this.searchNav.style.display = "none";
        }

        this.renderFiles();

        // Auto-scroll to first match when search is performed
        if (this.searchTerm && this.searchMatches.length > 0) {
          setTimeout(() => {
            this.scrollToCurrentMatch();
          }, 300); // Small delay to ensure DOM is updated
        }
      }, 300); // Debounce delay
    } catch (error) {
      console.error(`Search failed: ${error.message}`);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  handleSearchKeydown(e) {
    if (!this.searchTerm) return;

    try {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          this.navigateSearch("prev");
        } else {
          this.navigateSearch("next");
        }
      }
    } catch (error) {
      console.error(`Search navigation failed: ${error.message}`);
      throw new Error(`Search navigation failed: ${error.message}`);
    }
  }

  findAllMatches() {
    try {
      this.searchMatches = [];

      this.files.forEach((file) => {
        try {
          // Search in filename
          const nameMatches = this.getMatchPositions(
            file.name,
            this.searchTerm
          );
          nameMatches.forEach((position, index) => {
            this.searchMatches.push({
              fileId: file.id,
              type: "name",
              position: position,
              matchIndex: index,
            });
          });

          // Search in content
          if (typeof file.content === "string" && !file.isBinary) {
            const contentMatches = this.getMatchPositions(
              file.content,
              this.searchTerm
            );
            contentMatches.forEach((position, index) => {
              this.searchMatches.push({
                fileId: file.id,
                type: "content",
                position: position,
                matchIndex: index,
              });
            });
          }
        } catch (error) {
          console.error(`Error searching in file ${file.name}:`, error);
        }
      });
    } catch (error) {
      console.error(`Failed to find search matches: ${error.message}`);
      throw new Error(`Failed to find search matches: ${error.message}`);
    }
  }

  getMatchPositions(text, searchTerm) {
    if (!text || !searchTerm) return [];

    try {
      const matches = [];
      const lowerText = text.toLowerCase();
      let index = lowerText.indexOf(searchTerm);

      while (index !== -1) {
        matches.push(index);
        index = lowerText.indexOf(searchTerm, index + 1);
      }

      return matches;
    } catch (error) {
      console.error("Error finding match positions:", error);
      return [];
    }
  }

  navigateSearch(direction) {
    if (this.searchMatches.length === 0) return;

    try {
      if (direction === "next") {
        this.currentMatchIndex =
          (this.currentMatchIndex + 1) % this.searchMatches.length;
      } else {
        this.currentMatchIndex =
          (this.currentMatchIndex - 1 + this.searchMatches.length) %
          this.searchMatches.length;
      }

      this.updateSearchNav();
      this.scrollToCurrentMatch();
    } catch (error) {
      console.error(`Failed to navigate search: ${error.message}`);
      throw new Error(`Failed to navigate search: ${error.message}`);
    }
  }

  updateSearchNav() {
    try {
      const total = this.searchMatches.length;
      const current = total > 0 ? this.currentMatchIndex + 1 : 0;

      this.searchCount.textContent = `${current}/${total}`;
      this.prevMatchBtn.disabled = total === 0;
      this.nextMatchBtn.disabled = total === 0;
    } catch (error) {
      console.error("Error updating search navigation:", error);
    }
  }

  scrollToCurrentMatch() {
    if (this.searchMatches.length === 0) return;

    try {
      const match = this.searchMatches[this.currentMatchIndex];
      const fileBlock = document.querySelector(
        `[data-file-id="${match.fileId}"]`
      );

      if (fileBlock) {
        // Expand the file if it's collapsed
        const wrapper = document.getElementById(
          `content-wrapper-${match.fileId}`
        );
        const icon = document.getElementById(`expand-icon-${match.fileId}`);

        if (wrapper && wrapper.style.display === "none") {
          wrapper.style.display = "block";
          if (icon) icon.textContent = "▼";
        }

        // For HTML files, ensure we show the code view if the match is in content
        if (match.type === "content") {
          const file = this.files.find((f) => f.id === match.fileId);
          if (
            file &&
            (file.isHTML || file.isImage || file.isVideo || file.isAudio)
          ) {
            // Switch to code view to show the highlighted content
            this.toggleMediaView(match.fileId, "code");
          }
        }

        // Only scroll the main page if the file block is not visible
        const fileBlockRect = fileBlock.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Check if file block is not visible in viewport
        if (fileBlockRect.top < 0 || fileBlockRect.bottom > viewportHeight) {
          fileBlock.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        // Highlight current match
        this.highlightCurrentMatch(match);
      }
    } catch (error) {
      console.error("Error scrolling to match:", error);
    }
  }

  highlightCurrentMatch(match) {
    try {
      // Remove previous current highlights and focus indicators
      document.querySelectorAll("mark.current").forEach((mark) => {
        mark.classList.remove("current");
      });

      // Remove previous focus indicators
      document.querySelectorAll(".search-focus").forEach((el) => {
        el.classList.remove("search-focus");
      });

      // Add current highlight
      setTimeout(() => {
        try {
          if (match.type === "name") {
            const nameElement = document.getElementById(
              `name-display-${match.fileId}`
            );
            if (nameElement) {
              const marks = nameElement.querySelectorAll("mark");
              if (marks.length > match.matchIndex && marks[match.matchIndex]) {
                marks[match.matchIndex].classList.add("current");

                // Smooth scroll to the name element with better positioning
                nameElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                  inline: "nearest",
                });
              }
            }
          } else {
            // For content matches, look in multiple possible locations
            let contentElement = document.getElementById(
              `content-display-${match.fileId}`
            );

            // If not found, try looking in the code view for media files
            if (!contentElement) {
              const codeView = document.getElementById(`code-${match.fileId}`);
              if (codeView) {
                contentElement = codeView.querySelector(
                  `#content-display-${match.fileId}`
                );
              }
            }

            if (contentElement) {
              // Re-apply search highlighting to ensure marks are present
              const file = this.files.find((f) => f.id === match.fileId);
              if (file) {
                const highlightedContent = this.highlightSearch(file.content);
                const codeElement = contentElement.querySelector("code");
                if (codeElement) {
                  codeElement.innerHTML = highlightedContent;
                } else {
                  contentElement.innerHTML = highlightedContent;
                }
              }

              // Now find and highlight the specific match
              const marks = contentElement.querySelectorAll("mark");
              if (marks.length > match.matchIndex && marks[match.matchIndex]) {
                const currentMark = marks[match.matchIndex];
                currentMark.classList.add("current");

                // Get the viewport dimensions
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;

                // Get the mark's position
                const markRect = currentMark.getBoundingClientRect();

                // Calculate if the mark is visible in the viewport
                const isVisible =
                  markRect.top >= 0 &&
                  markRect.bottom <= viewportHeight &&
                  markRect.left >= 0 &&
                  markRect.right <= viewportWidth;

                // If not visible, scroll to center it in viewport
                if (!isVisible) {
                  currentMark.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "center",
                  });
                }

                // Add visual focus with animation
                setTimeout(() => {
                  try {
                    currentMark.classList.add("search-focus");

                    // Add focus to the containing file block
                    const fileBlock = currentMark.closest(".file-block");
                    if (fileBlock) {
                      fileBlock.classList.add("search-focus");

                      // Remove focus after animation
                      setTimeout(() => {
                        fileBlock.classList.remove("search-focus");
                      }, 2000);
                    }

                    // Remove focus from mark after animation
                    setTimeout(() => {
                      currentMark.classList.remove("search-focus");
                    }, 3000);
                  } catch (focusError) {
                    console.error("Error adding focus to match:", focusError);
                  }
                }, 100);
              }
            }
          }
        } catch (error) {
          console.error("Error highlighting current match:", error);
        }
      }, 100);
    } catch (error) {
      console.error("Error in highlightCurrentMatch:", error);
    }
  }
  // Enhanced error recovery and retry functionality
  retryFailedOperation(operation, maxRetries = 3) {
    return new Promise(async (resolve, reject) => {
      let attempts = 0;

      while (attempts < maxRetries) {
        try {
          const result = await operation();
          resolve(result);
          return;
        } catch (error) {
          attempts++;
          console.warn(
            `Operation failed (attempt ${attempts}/${maxRetries}):`,
            error
          );

          if (attempts >= maxRetries) {
            reject(
              new Error(
                `Operation failed after ${maxRetries} attempts: ${error.message}`
              )
            );
            return;
          }

          // Exponential backoff delay
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          await this.delay(delay);
        }
      }
    });
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Enhanced error boundary for critical operations
  async safeExecute(operation, fallback = null, context = "operation") {
    try {
      return await operation();
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      this.handleError(`Failed to execute ${context}`, error);

      if (fallback && typeof fallback === "function") {
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${context}:`, fallbackError);
          this.showToast(
            `Critical error in ${context}. Please refresh the page.`,
            "error"
          );
        }
      }

      return null;
    }
  }

  // Memory management for large files
  cleanupMemory() {
    try {
      // Clear any blob URLs to prevent memory leaks
      this.files.forEach((file) => {
        if (
          file.content &&
          typeof file.content === "string" &&
          file.content.startsWith("blob:")
        ) {
          URL.revokeObjectURL(file.content);
        }
      });

      // Clear temporary data
      if (this.searchMatches) {
        this.searchMatches.length = 0;
      }

      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
    } catch (error) {
      console.warn("Error during memory cleanup:", error);
    }
  }

  // Enhanced validation with better user feedback
  validateFileInput(file) {
    const errors = [];

    if (!file) {
      errors.push("Invalid file object");
      return { isValid: false, errors };
    }

    if (!file.name || file.name.trim() === "") {
      errors.push("File name is required");
    }

    if (typeof file.size !== "number" || file.size < 0) {
      errors.push("Invalid file size");
    }

    if (file.size === 0) {
      errors.push("File is empty");
    }

    if (file.size > 100 * 1024 * 1024) {
      // 100MB hard limit
      errors.push(
        `File too large: ${this.formatFileSize(file.size)} (max 100MB)`
      );
    }

    // Check for suspicious file extensions
    const suspiciousExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".scr",
      ".pif",
      ".com",
    ];
    const extension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (suspiciousExtensions.includes(extension)) {
      errors.push(`Potentially unsafe file type: ${extension}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  renderFiles() {
    try {
      console.log("Rendering files. Total count:", this.files.length);

      if (this.files.length === 0) {
        this.filesContainer.innerHTML = `
          <div class="no-files">
          <div class="no-files-icon"><i class="fas fa-folder-open"></i></div>
          <h3>No files uploaded yet</h3>
          <p>Upload some files to get started</p>
        </div>
        `;
        return;
      }

      let filteredFiles = this.files;
      if (this.searchTerm) {
        filteredFiles = this.files.filter(
          (file) =>
            file.name.toLowerCase().includes(this.searchTerm) ||
            (typeof file.content === "string" &&
              file.content.toLowerCase().includes(this.searchTerm))
        );
      }

      console.log("Filtered files count:", filteredFiles.length);

      switch (this.currentView) {
        case "list":
          this.renderListView(filteredFiles);
          break;
        case "tree":
          this.renderTreeView(filteredFiles);
          break;
        case "code":
          this.renderCodeView(filteredFiles);
          break;
        default:
          throw new Error(`Unknown view type: ${this.currentView}`);
      }
    } catch (error) {
      this.handleError("Failed to render files", error);
      // Fallback rendering
      this.filesContainer.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>Error displaying files</h3>
          <p>Please try refreshing the page</p>
        </div>
      `;
    }
  }

  renderListView(files) {
    try {
      console.log("Rendering list view with files:", files.length);

      // Use DocumentFragment for better performance with large file lists
      if (files.length > 50) {
        this.filesContainer.innerHTML = "";
        const fragment = document.createDocumentFragment();

        files.forEach((file, index) => {
          try {
            const div = document.createElement("div");
            div.innerHTML = this.createFileBlock(file, index);
            fragment.appendChild(div.firstChild);
          } catch (error) {
            console.error(`Error creating file block for ${file.name}:`, error);
            const errorDiv = document.createElement("div");
            errorDiv.className = "file-error";
            errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>Error displaying ${this.escapeHtml(file.name)}</span>
            <button onclick="fileManager.retryFileRender('${
              file.id
            }')" class="retry-btn">
              <i class="fas fa-redo"></i> Retry
            </button>
          `;
            fragment.appendChild(errorDiv);
          }
        });

        this.filesContainer.appendChild(fragment);
      } else {
        const html = files
          .map((file, index) => {
            try {
              return this.createFileBlock(file, index);
            } catch (error) {
              console.error(
                `Error creating file block for ${file.name}:`,
                error
              );
              return `
              <div class="file-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Error displaying ${this.escapeHtml(file.name)}</span>
                <button onclick="fileManager.retryFileRender('${
                  file.id
                }')" class="retry-btn">
                  <i class="fas fa-redo"></i> Retry
                </button>
              </div>
            `;
            }
          })
          .join("");

        console.log("Generated HTML length:", html.length);
        this.filesContainer.innerHTML = html;
      }

      this.bindFileEvents();
      this.initializeDragAndDrop();
    } catch (error) {
      console.error(`Failed to render list view: ${error.message}`);
      throw new Error(`Failed to render list view: ${error.message}`);
    }
  }

  renderTreeView(files) {
    try {
      const tree = this.buildFileTree(files);
      const html = `
        <div class="tree-view">
          <div class="tree-header">
            <input type="text" id="tree-title" class="tree-title-input" value="📦 File Structure" onblur="fileManager.saveTreeTitle()" onkeypress="if(event.key === 'Enter') fileManager.saveTreeTitle()">
            <button class="copy-tree-btn" onclick="fileManager.copyTreeStructure()"><i class="fas fa-copy"></i> Copy Tree</button>
          </div>
          ${this.renderTreeNode(tree, "", true)}
        </div>
      `;
      this.filesContainer.innerHTML = html;
      this.bindTreeEvents();
    } catch (error) {
      throw new Error(`Failed to render tree view: ${error.message}`);
    }
  }

  renderCodeView(files) {
    try {
      const commands = this.generateCommands(files);
      const html = `
        <div class="code-view">
          <div class="code-header">
            <h3><i class="fas fa-terminal"></i> Terminal Commands</h3>
            <button class="copy-commands-btn" onclick="fileManager.copyCommands()">
              <i class="fas fa-copy"></i> Copy Commands
            </button>
          </div>
          <pre class="code-block"><code class="language-bash">${commands}</code></pre>
        </div>
      `;
      this.filesContainer.innerHTML = html;

      // Apply syntax highlighting if Prism is available
      if (typeof Prism !== "undefined") {
        try {
          Prism.highlightAll();
        } catch (error) {
          console.warn("Prism syntax highlighting failed:", error);
        }
      }
    } catch (error) {
      throw new Error(`Failed to render code view: ${error.message}`);
    }
  }

  buildFileTree(files) {
    try {
      const tree = {};

      files.forEach((file) => {
        try {
          const path = this.useRelativePaths ? file.relativePath : file.name;
          const parts = path.split("/");
          let current = tree;

          parts.forEach((part, index) => {
            if (!current[part]) {
              current[part] =
                index === parts.length - 1
                  ? { __file: file, __isFile: true }
                  : {};
            }
            current = current[part];
          });
        } catch (error) {
          console.error(`Error building tree for file ${file.name}:`, error);
        }
      });

      return tree;
    } catch (error) {
      throw new Error(`Failed to build file tree: ${error.message}`);
    }
  }

  renderTreeNode(node, path, isRoot = false) {
    let html = '<ul class="tree-list">';

    // Sort entries: folders first, then files
    const entries = Object.keys(node)
      .filter(key => !key.startsWith("__"))
      .sort((a, b) => {
        const aIsFile = node[a].__isFile;
        const bIsFile = node[b].__isFile;
        
        // Folders first
        if (!aIsFile && bIsFile) return -1;
        if (aIsFile && !bIsFile) return 1;
        
        // Then alphabetically
        return a.localeCompare(b);
      });

    entries.forEach((key) => {
      const item = node[key];
      const currentPath = path ? `${path}/${key}` : key;
      const isFile = item.__isFile;
      const icon = isFile
        ? this.getFileIcon(item.__file)
        : '<i class="fas fa-folder"></i>';

      html += `<li class="tree-item ${isFile ? "file" : "folder"}">`;

      if (isFile) {
        html += `
                    <div class="tree-file" data-file-id="${item.__file.id}">
                        <span class="tree-icon">${icon}</span>
                        <span class="tree-name">${this.highlightSearch(
                          key
                        )}</span>
                        <div class="tree-actions">
                            <button class="tree-action-btn" onclick="fileManager.copyFileName('${key}')" title="Copy name"><i class="fas fa-copy"></i></button>
                            <button class="tree-action-btn" onclick="fileManager.toggleFileContent(${
                              item.__file.id
                            })" title="Toggle content"><i class="fas fa-eye"></i></button>
                        </div>
                    </div>
                    <div class="tree-file-content" id="content-${
                      item.__file.id
                    }" style="display: none;">
                        ${this.createFileContentDisplay(item.__file)}
                    </div>
                `;
      } else {
        html += `
                    <div class="tree-folder" onclick="fileManager.toggleFolder(this)">
                        <span class="tree-icon"><i class="fas fa-folder"></i></span>
                        <span class="tree-name">${this.highlightSearch(
                          key
                        )}</span>
                        <span class="tree-toggle"><i class="fas fa-chevron-right"></i></span>
                    </div>
                    <div class="tree-children" style="display: none;">
                        ${this.renderTreeNode(item, currentPath, false)}
                    </div>
                `;
      }

      html += "</li>";
    });

    html += "</ul>";
    return html;
  }

  generateCommands(files) {
    const commands = [];
    const directories = new Set();

    files.forEach((file) => {
      const path = this.useRelativePaths ? file.relativePath : file.name;
      const dir = path.substring(0, path.lastIndexOf("/"));

      if (dir && !directories.has(dir)) {
        directories.add(dir);
        commands.push(`mkdir -p "${dir}"`);
      }
    });

    files.forEach((file) => {
      const path = this.useRelativePaths ? file.relativePath : file.name;
      commands.push(`touch "${path}"`);
    });

    return commands.join("\n");
  }

  createFileBlock(file, index) {
    const displayName = this.useRelativePaths ? file.relativePath : file.name;
    const highlightedName = this.highlightSearch(displayName);
    const icon = this.getFileIcon(file);

    return `
            <div class="file-block" data-file-id="${
              file.id
            }" data-index="${index}" draggable="true">
                <div class="file-header" onclick="fileManager.toggleFileContentVisibility(${
                  file.id
                })">
                    <div class="file-info">
                        <span class="drag-handle">⋮⋮</span>
                        <span class="file-icon">${icon}</span>
                        <span class="file-name" id="name-display-${
                          file.id
                        }">${highlightedName}</span>
                        <input type="text" class="file-name-input" id="name-input-${
                          file.id
                        }" value="${displayName}" style="display: none;" onblur="fileManager.saveFileName(${
      file.id
    })" onkeypress="if(event.key === 'Enter') fileManager.saveFileName(${
      file.id
    })">
                        <span class="file-size">${this.formatFileSize(
                          file.size
                        )}</span>
                        <span class="expand-icon" id="expand-icon-${
                          file.id
                        }"><i class="fas fa-chevron-right"></i></span>
                    </div>
                    <div class="file-actions" onclick="event.stopPropagation()">
                        <button class="action-btn edit-name-btn" onclick="fileManager.editFileName(${
                          file.id
                        })" title="Edit filename">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn copy-name-btn" onclick="fileManager.copyFileName('${displayName}')" title="Copy filename">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="action-btn delete-file-btn" onclick="fileManager.deleteFile(${
                          file.id
                        })" title="Delete file">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="file-content-wrapper" id="content-wrapper-${
                  file.id
                }" style="display: none;">
                    ${this.createFileContentDisplay(file)}
                </div>
            </div>
        `;
  }

  createFileContentDisplay(file) {
    if (file.isHTML) {
      return `
                <div class="media-container">
                    <div class="media-controls">
                        <button class="media-btn active" onclick="fileManager.toggleMediaView(${
                          file.id
                        }, 'preview')">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button class="media-btn" onclick="fileManager.toggleMediaView(${
                          file.id
                        }, 'code')">
                            <i class="fas fa-code"></i> Code
                        </button>
                    </div>
                    <div class="media-content">
                        <div class="media-preview" id="preview-${file.id}">
                            <iframe srcdoc="${file.content.replace(
                              /"/g,
                              "&quot;"
                            )}" class="html-preview-iframe" sandbox="allow-scripts"></iframe>
                        </div>
                        <div class="media-code" id="code-${
                          file.id
                        }" style="display: none;">
                            <div class="file-content-header">
                                <span class="content-label">HTML Content:</span>
                                <button class="action-btn edit-content-btn" onclick="fileManager.editFileContent(${
                                  file.id
                                })" title="Edit content">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn copy-content-btn" onclick="fileManager.copyFileContent(${
                                  file.id
                                })" title="Copy content">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <div class="file-content-wrapper">
                                <pre class="file-content" id="content-display-${
                                  file.id
                                }"><code class="language-html">${this.highlightSearch(
        this.escapeHtml(file.content)
      )}</code></pre>
                            </div>
                            <textarea class="file-content-textarea" id="content-textarea-${
                              file.id
                            }" style="display: none;" onblur="fileManager.saveFileContent(${
        file.id
      })">${file.content}</textarea>
                        </div>
                    </div>
                </div>
            `;
    } else if (file.isImage || file.isVideo || file.isAudio) {
      return `
                <div class="media-container">
                    <div class="media-controls">
                        <button class="media-btn active" onclick="fileManager.toggleMediaView(${
                          file.id
                        }, 'preview')">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button class="media-btn" onclick="fileManager.toggleMediaView(${
                          file.id
                        }, 'code')">
                            <i class="fas fa-code"></i> Code
                        </button>
                    </div>
                    <div class="media-content">
                        <div class="media-preview" id="preview-${file.id}">
                            ${this.createMediaPreview(file)}
                        </div>
                        <div class="media-code" id="code-${
                          file.id
                        }" style="display: none;">
                            <div class="file-content-header">
                                <span class="content-label">Base64 Content:</span>
                                <button class="action-btn copy-content-btn" onclick="fileManager.copyFileContent(${
                                  file.id
                                })" title="Copy content">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <div class="file-content-wrapper">
                                <pre class="file-content" id="content-display-${
                                  file.id
                                }">${this.highlightSearch(
        file.content.substring(0, 500)
      )}${file.content.length > 500 ? "..." : ""}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            `;
    } else if (file.isBinary) {
      return `
                <div class="file-content-header">
                    <span class="content-label">Binary File (${
                      file.type
                    }):</span>
                    <span class="binary-info">${this.formatFileSize(
                      file.size
                    )}</span>
                </div>
                <div class="binary-file-info">
                    <p>This is a binary file and cannot be displayed as text.</p>
                </div>
            `;
    } else {
      const language = this.getLanguageFromFilename(file.name);
      const highlightedContent = this.highlightSearch(file.content);
      return `
                <div class="file-content-header">
                    <span class="content-label">Content:</span>
                    <button class="action-btn edit-content-btn" onclick="fileManager.editFileContent(${file.id})" title="Edit content">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn copy-content-btn" onclick="fileManager.copyFileContent(${file.id})" title="Copy content">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn copy-both-btn" onclick="fileManager.copyBoth(${file.id})" title="Copy filename + content">
                        <i class="fas fa-copy"></i> Both
                    </button>
                </div>
                <div class="file-content-wrapper">
                    <pre class="file-content" id="content-display-${file.id}"><code class="language-${language}">${highlightedContent}</code></pre>
                </div>
                <textarea class="file-content-textarea" id="content-textarea-${file.id}" style="display: none;" onblur="fileManager.saveFileContent(${file.id})">${file.content}</textarea>
            `;
    }
  }

  createMediaPreview(file) {
    if (file.isImage) {
      return `<img src="${file.content}" alt="${file.name}" class="media-preview-img">`;
    } else if (file.isVideo) {
      return `<video controls class="media-preview-video"><source src="${file.content}" type="${file.type}"></video>`;
    } else if (file.isAudio) {
      return `<audio controls class="media-preview-audio"><source src="${file.content}" type="${file.type}"></audio>`;
    }
    return "";
  }

  toggleMediaView(fileId, view) {
    try {
      const previewEl = document.getElementById(`preview-${fileId}`);
      const codeEl = document.getElementById(`code-${fileId}`);
      const buttons = document.querySelectorAll(
        `[data-file-id="${fileId}"] .media-btn`
      );

      if (!previewEl || !codeEl) {
        console.error(`Media elements not found for file ID: ${fileId}`);
        this.showToast("Error: Media elements not found");
        return;
      }

      buttons.forEach((btn) => btn.classList.remove("active"));

      if (view === "preview") {
        previewEl.style.display = "block";
        codeEl.style.display = "none";
        const previewBtn = document.querySelector(
          `[onclick="fileManager.toggleMediaView(${fileId}, 'preview')"]`
        );
        if (previewBtn) previewBtn.classList.add("active");
      } else {
        previewEl.style.display = "none";
        codeEl.style.display = "block";
        const codeBtn = document.querySelector(
          `[onclick="fileManager.toggleMediaView(${fileId}, 'code')"]`
        );
        if (codeBtn) codeBtn.classList.add("active");
      }
    } catch (error) {
      console.error("Error in toggleMediaView:", error);
      this.showToast("Error toggling media view");
    }
  }

  getFileIcon(file) {
    if (file.isImage) return '<i class="fas fa-image"></i>';
    if (file.isVideo) return '<i class="fas fa-video"></i>';
    if (file.isAudio) return '<i class="fas fa-music"></i>';

    const ext = file.name.split(".").pop().toLowerCase();
    const iconMap = {
      js: '<i class="fab fa-js-square"></i>',
      ts: '<i class="fas fa-file-code"></i>',
      jsx: '<i class="fab fa-react"></i>',
      tsx: '<i class="fab fa-react"></i>',
      html: '<i class="fab fa-html5"></i>',
      css: '<i class="fab fa-css3-alt"></i>',
      scss: '<i class="fab fa-sass"></i>',
      sass: '<i class="fab fa-sass"></i>',
      json: '<i class="fas fa-file-code"></i>',
      xml: '<i class="fas fa-file-code"></i>',
      yaml: '<i class="fas fa-file-alt"></i>',
      yml: '<i class="fas fa-file-alt"></i>',
      md: '<i class="fab fa-markdown"></i>',
      txt: '<i class="fas fa-file-alt"></i>',
      log: '<i class="fas fa-file-alt"></i>',
      py: '<i class="fab fa-python"></i>',
      java: '<i class="fab fa-java"></i>',
      cpp: '<i class="fas fa-file-code"></i>',
      c: '<i class="fas fa-file-code"></i>',
      php: '<i class="fab fa-php"></i>',
      rb: '<i class="fas fa-gem"></i>',
      go: '<i class="fas fa-file-code"></i>',
      sql: '<i class="fas fa-database"></i>',
      db: '<i class="fas fa-database"></i>',
      pdf: '<i class="fas fa-file-pdf"></i>',
      doc: '<i class="fas fa-file-word"></i>',
      docx: '<i class="fas fa-file-word"></i>',
      zip: '<i class="fas fa-file-archive"></i>',
      rar: '<i class="fas fa-file-archive"></i>',
      "7z": '<i class="fas fa-file-archive"></i>',
      exe: '<i class="fas fa-cog"></i>',
      app: '<i class="fas fa-mobile-alt"></i>',
    };

    return iconMap[ext] || '<i class="fas fa-file"></i>';
  }

  getLanguageFromFilename(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const langMap = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      html: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      php: "php",
      rb: "ruby",
      go: "go",
      sql: "sql",
      sh: "bash",
      bash: "bash",
    };
    return langMap[ext] || "text";
  }

  highlightSearch(text) {
    if (!this.searchTerm || typeof text !== "string") return text;

    // Escape special regex characters and create case-insensitive regex
    const escapedTerm = this.searchTerm.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedTerm})`, "gi");

    // Replace matches with marked text
    return text.replace(regex, "<mark>$1</mark>");
  }

  bindFileEvents() {
    // Apply syntax highlighting if Prism is available
    if (typeof Prism !== "undefined") {
      Prism.highlightAll();
    }
  }

  initializeDragAndDrop() {
    if (this.currentView !== "list") return;

    // Clean up existing listeners first
    if (this.dragListeners) {
      this.dragListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    }
    this.dragListeners = [];

    const fileBlocks = document.querySelectorAll(".file-block");

    fileBlocks.forEach((block) => {
      const handlers = {
        dragstart: this.handleDragStart.bind(this),
        dragover: this.handleDragOver.bind(this),
        drop: this.handleDragDrop.bind(this),
        dragend: this.handleDragEnd.bind(this),
        dragenter: this.handleDragEnter.bind(this),
        dragleave: this.handleDragLeave.bind(this),
      };

      Object.entries(handlers).forEach(([event, handler]) => {
        block.addEventListener(event, handler);
        this.dragListeners.push({ element: block, event, handler });
      });
    });
  }

  handleDragStart(e) {
    if (
      !e.target.closest(".drag-handle") &&
      !e.target.classList.contains("file-block")
    ) {
      return;
    }

    const fileBlock = e.target.closest(".file-block");
    if (!fileBlock) return;

    this.draggedElement = fileBlock;
    this.draggedIndex = parseInt(fileBlock.dataset.index);

    // Remove the dragging class that causes tilt effect
    // fileBlock.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", fileBlock.outerHTML);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  handleDragEnter(e) {
    e.preventDefault();
    const fileBlock = e.target.closest(".file-block");
    if (fileBlock && fileBlock !== this.draggedElement) {
      fileBlock.classList.add("drag-over");
    }
  }

  handleDragLeave(e) {
    const fileBlock = e.target.closest(".file-block");
    if (fileBlock && !fileBlock.contains(e.relatedTarget)) {
      fileBlock.classList.remove("drag-over");
    }
  }

  handleDragDrop(e) {
    e.preventDefault();

    const targetBlock = e.target.closest(".file-block");
    if (
      !targetBlock ||
      !this.draggedElement ||
      targetBlock === this.draggedElement
    ) {
      return;
    }

    const targetIndex = parseInt(targetBlock.dataset.index);
    const draggedIndex = this.draggedIndex;

    // Reorder files array
    const draggedFile = this.files[draggedIndex];
    this.files.splice(draggedIndex, 1);

    // Adjust target index if we removed an item before it
    const newTargetIndex =
      draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    this.files.splice(newTargetIndex, 0, draggedFile);

    // Determine direction for user feedback
    const direction = draggedIndex < targetIndex ? "down" : "up";
    const directionText = direction === "up" ? "UP" : "Down";

    // Re-render the files
    this.renderFiles();
    this.showToast(`ℹ️ Moved "${draggedFile.name}" ${directionText}`, "info");
  }

  handleDragEnd(e) {
    const fileBlock = e.target.closest(".file-block");
    if (fileBlock) {
      // Remove dragging class if it was added
      fileBlock.classList.remove("dragging");
    }

    // Clean up all drag-over classes
    document.querySelectorAll(".file-block").forEach((block) => {
      block.classList.remove("drag-over");
    });

    this.draggedElement = null;
    this.draggedIndex = null;
  }

  bindTreeEvents() {
    // Tree events are handled by onclick attributes for simplicity
  }

  toggleFileContent(fileId) {
    const contentEl = document.getElementById(`content-${fileId}`);
    if (contentEl) {
      if (contentEl.style.display === "none") {
        contentEl.style.display = "block";
      } else {
        contentEl.style.display = "none";
      }
    }
  }

  saveTreeTitle() {
    const titleInput = document.getElementById("tree-title");
    if (titleInput) {
      this.showToast("Title updated");
    }
  }

  copyTreeStructure() {
    const treeText = this.generateTreeText(
      this.buildFileTree(this.files),
      "",
      true
    );
    this.copyToClipboard(treeText);
    this.showToast("Tree structure copied");
  }

  copyCommands() {
    try {
      if (this.files.length === 0) {
        this.showToast("No files to generate commands for");
        return;
      }

      const commands = this.generateCommands(this.files);
      this.copyToClipboard(commands);
      this.showToast("Terminal commands copied to clipboard");
    } catch (error) {
      console.error("Error copying commands:", error);
      this.showToast("Error copying commands");
    }
  }

  generateTreeText(node, indent = "", isRoot = false) {
    let text = "";
    const entries = Object.entries(node).filter(
      ([key]) => !key.startsWith("__")
    );

    entries.forEach(([key, value], index) => {
      const isLast = index === entries.length - 1;
      const isFile = value.__isFile;

      if (isRoot) {
        text += key + "\n";
      } else {
        text += indent + (isLast ? "└── " : "├── ") + key + "\n";
      }

      if (!isFile) {
        const newIndent = isRoot ? "" : indent + (isLast ? "    " : "│   ");
        text += this.generateTreeText(value, newIndent);
      }
    });

    return text;
  }

  toggleFolder(element) {
    const children = element.nextElementSibling;
    const toggle = element.querySelector(".tree-toggle i");

    if (children.style.display === "none") {
      children.style.display = "block";
      toggle.className = "fas fa-chevron-down";
    } else {
      children.style.display = "none";
      toggle.className = "fas fa-chevron-right";
    }
  }

  retryFileRender(fileId) {
    try {
      const file = this.files.find((f) => f.id === fileId);
      if (!file) {
        this.showToast("File not found", "error");
        return;
      }

      // Re-render all files
      this.renderFiles();
      this.showToast("Refreshed file display", "success");
    } catch (error) {
      this.handleError("Failed to retry file render", error);
    }
  }

  toggleFileContentVisibility(fileId) {
    const wrapper = document.getElementById(`content-wrapper-${fileId}`);
    const icon = document.getElementById(`expand-icon-${fileId}`);

    if (wrapper.style.display === "none") {
      wrapper.style.display = "block";
      icon.innerHTML = '<i class="fas fa-chevron-down"></i>';
    } else {
      wrapper.style.display = "none";
      icon.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
  }

  editFileName(fileId) {
    const nameDisplay = document.getElementById(`name-display-${fileId}`);
    const nameInput = document.getElementById(`name-input-${fileId}`);

    nameDisplay.style.display = "none";
    nameInput.style.display = "inline-block";
    nameInput.focus();
    nameInput.select();
  }

  saveFileName(fileId) {
    try {
      const nameDisplay = document.getElementById(`name-display-${fileId}`);
      const nameInput = document.getElementById(`name-input-${fileId}`);

      if (!nameDisplay || !nameInput) {
        console.error(`Name elements not found for file ID: ${fileId}`);
        this.showToast("Error: Name elements not found");
        return;
      }

      const file = this.files.find((f) => f.id === fileId);

      if (!file) {
        console.error(`File not found with ID: ${fileId}`);
        this.showToast("Error: File not found");
        nameDisplay.style.display = "inline";
        nameInput.style.display = "none";
        return;
      }

      const newName = nameInput.value.trim();
      if (!newName) {
        this.showToast("Error: Filename cannot be empty");
        nameDisplay.style.display = "inline";
        nameInput.style.display = "none";
        return;
      }

      // Validate filename (basic validation)
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(newName)) {
        this.showToast("Error: Invalid characters in filename");
        nameInput.focus();
        return;
      }

      file.name = newName;
      file.relativePath = newName;

      nameDisplay.innerHTML = this.highlightSearch(newName);
      nameDisplay.style.display = "inline";
      nameInput.style.display = "none";

      this.showToast(`Renamed to: ${file.name}`);
    } catch (error) {
      console.error("Error in saveFileName:", error);
      this.showToast("Error saving filename");
    }
  }

  editFileContent(fileId) {
    const contentDisplay = document.getElementById(`content-display-${fileId}`);
    const contentTextarea = document.getElementById(
      `content-textarea-${fileId}`
    );

    if (contentDisplay && contentTextarea) {
      contentDisplay.style.display = "none";
      contentTextarea.style.display = "block";
      contentTextarea.focus();
    }
  }

  saveFileContent(fileId) {
    try {
      const contentDisplay = document.getElementById(
        `content-display-${fileId}`
      );
      const contentTextarea = document.getElementById(
        `content-textarea-${fileId}`
      );

      if (!contentDisplay || !contentTextarea) {
        console.error(`Content elements not found for file ID: ${fileId}`);
        this.showToast("Error: Content elements not found");
        return;
      }

      const file = this.files.find((f) => f.id === fileId);

      if (!file) {
        console.error(`File not found with ID: ${fileId}`);
        this.showToast("Error: File not found");
        return;
      }

      const newContent = contentTextarea.value;
      if (newContent === undefined || newContent === null) {
        this.showToast("Error: Invalid content");
        return;
      }

      file.content = newContent;
      file.size = newContent.length;

      const language = this.getLanguageFromFilename(file.name);
      const highlightedContent = this.highlightSearch(file.content);
      contentDisplay.innerHTML = `<code class="language-${language}">${highlightedContent}</code>`;

      contentDisplay.style.display = "block";
      contentTextarea.style.display = "none";

      this.updateStats();
      this.showToast("Content updated");

      // Re-apply syntax highlighting with error handling
      if (typeof Prism !== "undefined") {
        try {
          const codeElement = contentDisplay.querySelector("code");
          if (codeElement) {
            Prism.highlightElement(codeElement);
          }
        } catch (prismError) {
          console.error("Error applying syntax highlighting:", prismError);
        }
      }
    } catch (error) {
      console.error("Error in saveFileContent:", error);
      this.showToast("Error saving content");
    }
  }

  copyFileName(name) {
    this.copyToClipboard(name);
    this.showToast(`Copied filename: ${name}`);
  }

  copyFileContent(fileId) {
    try {
      const file = this.files.find((f) => f.id === fileId);
      if (!file) {
        console.error(`File not found with ID: ${fileId}`);
        this.showToast("Error: File not found");
        return;
      }

      if (!file.content && file.content !== "") {
        this.showToast("Error: No content to copy");
        return;
      }

      this.copyToClipboard(file.content);
      this.showToast(`Copied content of: ${file.name}`);
    } catch (error) {
      console.error("Error in copyFileContent:", error);
      this.showToast("Error copying content");
    }
  }

  copyBoth(fileId) {
    try {
      const file = this.files.find((f) => f.id === fileId);
      if (!file) {
        console.error(`File not found with ID: ${fileId}`);
        this.showToast("Error: File not found");
        return;
      }

      const displayName = this.useRelativePaths ? file.relativePath : file.name;
      if (!displayName) {
        this.showToast("Error: Invalid filename");
        return;
      }

      const content = file.content || "";
      const combined = `${displayName}\n\n${content}`;
      this.copyToClipboard(combined);
      this.showToast(`Copied both: ${file.name}`);
    } catch (error) {
      console.error("Error in copyBoth:", error);
      this.showToast("Error copying file data");
    }
  }

  copyAllFiles() {
    if (this.files.length === 0) {
      this.showToast("No files to copy");
      return;
    }

    const allContent = this.files
      .map((file) => {
        const displayName = this.useRelativePaths
          ? file.relativePath
          : file.name;
        return `${displayName}\n\n${file.content}\n\n${"=".repeat(50)}\n`;
      })
      .join("\n");

    this.copyToClipboard(allContent);
    this.showToast(`Copied all ${this.files.length} files`);
  }

  deleteFile(fileId) {
    try {
      const fileIndex = this.files.findIndex((f) => f.id === fileId);
      if (fileIndex === -1) {
        console.error(`File not found with ID: ${fileId}`);
        this.showToast("Error: File not found");
        return;
      }

      const fileName = this.files[fileIndex].name;

      this.showConfirmModal(
        "Delete File",
        `Are you sure you want to delete "${fileName}"?`,
        () => {
          this.files.splice(fileIndex, 1);
          this.selectedFiles.delete(fileId);

          try {
            this.renderFiles();
            this.updateStats();
            this.showToast(`Deleted: ${fileName}`);
          } catch (renderError) {
            console.error("Error re-rendering after delete:", renderError);
            this.showToast("File deleted but display may not be updated");
          }
        }
      );
    } catch (error) {
      console.error("Error in deleteFile:", error);
      this.showToast("Error deleting file");
    }
  }

  deleteAllFiles() {
    this.showConfirmModal(
      "Delete All Files",
      "Are you sure you want to delete ALL files? This action cannot be undone.",
      () => {
        const deletedCount = this.files.length;
        this.files = [];
        this.selectedFiles.clear();
        this.renderFiles();
        this.updateStats();
        this.showToast(`Deleted all ${deletedCount} files`);
      }
    );
  }

  copyToClipboard(text) {
    try {
      if (!text && text !== "") {
        this.showToast("Error: No content to copy");
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          this.fallbackCopyToClipboard(text);
        });
      } else {
        this.fallbackCopyToClipboard(text);
      }
    } catch (error) {
      console.error("Error in copyToClipboard:", error);
      this.fallbackCopyToClipboard(text);
    }
  }

  fallbackCopyToClipboard(text) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text || "";
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand("copy");
        if (!successful) {
          console.error("Copy command was unsuccessful");
          this.showToast("Copy failed - please copy manually");
        }
      } catch (err) {
        console.error("Fallback copy failed:", err);
        this.showToast("Copy failed - please copy manually");
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error("Error in fallbackCopyToClipboard:", error);
      this.showToast("Copy operation failed");
    }
  }

  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  updateStats() {
    this.fileCount.textContent = this.files.length;
    const totalBytes = this.files.reduce((sum, file) => sum + file.size, 0);
    this.totalSize.textContent = this.formatFileSize(totalBytes);
  }

  showToast(message, type = "info", duration = null) {
    if (!message) return;

    try {
      // Clear existing timeout
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
        this.toastTimeout = null;
      }

      // Validate toast element exists
      if (!this.toast) {
        console.error("Toast element not found");
        // Fallback: create toast element if it doesn't exist
        this.createToastElement();
        if (!this.toast) return;
      }

      const messageEl = this.toast.querySelector(".toast-message");
      if (!messageEl) {
        console.error("Toast message element not found");
        return;
      }

      // Set message content with HTML support for better formatting
      if (message.includes("\n")) {
        messageEl.innerHTML = message.replace(/\n/g, "<br>");
      } else {
        messageEl.textContent = message;
      }

      // Remove existing type classes
      this.toast.classList.remove("error", "warning", "success", "info");

      // Add type-specific class and icon
      if (type) {
        this.toast.classList.add(type);
      }

      // Add appropriate icon based on type
      const icon = this.getToastIcon(type);
      if (icon && !messageEl.textContent.startsWith(icon)) {
        if (message.includes("\n")) {
          messageEl.innerHTML = `${icon} ${messageEl.innerHTML}`;
        } else {
          messageEl.textContent = `${icon} ${messageEl.textContent}`;
        }
      }

      this.toast.classList.add("show");

      // Calculate auto-hide delay
      const baseDelay = duration || this.getToastDuration(type, message);
      this.toastTimeout = setTimeout(() => {
        this.hideToast();
      }, baseDelay);

      // Add click to dismiss functionality
      const dismissHandler = () => {
        this.hideToast();
        this.toast.removeEventListener("click", dismissHandler);
      };
      this.toast.addEventListener("click", dismissHandler);
    } catch (error) {
      console.error("Error showing toast:", error);
      // Fallback to console logging if toast fails
      console.log(`Toast (${type}): ${message}`);
    }
  }

  getToastIcon(type) {
    const icons = {
      error: "❌",
      warning: "⚠️",
      success: "✅",
      info: "ℹ️",
    };
    return icons[type] || "";
  }

  getToastDuration(type, message) {
    // Base durations
    const baseDurations = {
      error: 7000,
      warning: 5000,
      success: 3000,
      info: 3000,
    };

    let duration = baseDurations[type] || 3000;

    // Extend duration for longer messages
    if (message.length > 100) {
      duration += Math.min(2000, message.length * 20);
    }

    // Extend duration for multi-line messages
    const lineCount = (message.match(/\n/g) || []).length;
    if (lineCount > 0) {
      duration += lineCount * 1000;
    }

    return Math.min(duration, 15000); // Cap at 15 seconds
  }

  hideToast() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    this.toast.classList.remove("show");
  }

  createToastElement() {
    try {
      const existingToast = document.getElementById("toast");
      if (existingToast) {
        this.toast = existingToast;
        return;
      }

      const toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.innerHTML = `
        <span class="toast-message"></span>
        <button class="toast-close" onclick="fileManager.hideToast()">
          <i class="fas fa-times"></i>
        </button>
      `;
      document.body.appendChild(toast);
      this.toast = toast;
    } catch (error) {
      console.error("Failed to create toast element:", error);
    }
  }

  showLoadingOverlay(message = "Processing...") {
    let overlay = document.getElementById("loadingOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "loadingOverlay";
      overlay.className = "loading-overlay";
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-message">${message}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector(".loading-message").textContent = message;
      overlay.style.display = "flex";
    }
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  updateLoadingProgress(current, total, customMessage = null) {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;

    try {
      const messageEl = overlay.querySelector(".loading-message");
      const progressEl = overlay.querySelector(".loading-progress");

      if (messageEl) {
        if (customMessage) {
          messageEl.textContent = customMessage;
        } else {
          const percentage =
            total > 0 ? Math.round((current / total) * 100) : 0;
          messageEl.textContent = `Processing files... ${current}/${total} (${percentage}%)`;
        }
      }

      // Add or update progress bar
      if (!progressEl && total > 0) {
        const progressBar = document.createElement("div");
        progressBar.className = "loading-progress";
        progressBar.innerHTML = `
          <div class="loading-progress-bar">
            <div class="loading-progress-fill"></div>
          </div>
        `;

        const loadingContent = overlay.querySelector(".loading-content");
        if (loadingContent) {
          loadingContent.appendChild(progressBar);
        }
      }

      // Update progress bar
      const progressFill = overlay.querySelector(".loading-progress-fill");
      if (progressFill && total > 0) {
        const percentage = Math.min(100, Math.max(0, (current / total) * 100));
        progressFill.style.width = `${percentage}%`;
      }
    } catch (error) {
      console.error("Error updating loading progress:", error);
    }
  }

  toggleTheme() {
    document.body.classList.toggle("dark-theme");
    document.body.classList.toggle("light-theme");

    const isDark = document.body.classList.contains("dark-theme");

    // Update the icon in the theme toggle button
    const themeIcon = this.themeToggle?.querySelector("i");
    if (themeIcon) {
      themeIcon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    }

    // Save theme preference
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch (error) {
      console.log("localStorage not available, theme preference not saved");
    }
  }

  // Helper method to get element offset relative to a container
  getElementOffsetTop(element, container) {
    let offsetTop = 0;
    let currentElement = element;

    while (currentElement && currentElement !== container) {
      offsetTop += currentElement.offsetTop;
      currentElement = currentElement.offsetParent;

      // Break if we've gone outside the container
      if (currentElement && !container.contains(currentElement)) {
        break;
      }
    }

    return offsetTop;
  }

  // Cleanup method to prevent memory leaks
  destroy() {
    try {
      // Clear timeouts
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }

      // Clear file data
      this.files = [];
      this.selectedFiles.clear();
      this.searchMatches = [];

      // Remove global event listeners
      document.removeEventListener("keydown", this.safeHandleGlobalKeyboard);

      // Clear drag listeners
      if (this.dragListeners) {
        this.dragListeners.forEach(({ element, event, handler }) => {
          element.removeEventListener(event, handler);
        });
        this.dragListeners = [];
      }

      // Clear DOM
      if (this.filesContainer) {
        this.filesContainer.innerHTML = "";
      }

      console.log("File manager cleanup completed");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  // Initialize theme from localStorage
  initializeTheme() {
    try {
      const savedTheme = localStorage.getItem("theme") || "dark";

      // Update theme icon helper
      const updateThemeIcon = () => {
        const themeIcon = this.themeToggle?.querySelector("i");
        if (themeIcon) {
          const isDark = document.body.classList.contains("dark-theme");
          themeIcon.className = isDark ? "fas fa-sun" : "fas fa-moon";
        }
      };

      if (savedTheme === "light") {
        document.body.classList.remove("dark-theme");
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.add("dark-theme");
        document.body.classList.remove("light-theme");
      }

      // Update the icon after setting the theme
      setTimeout(updateThemeIcon, 100);
    } catch (error) {
      console.error("Error initializing theme:", error);
      // Default to dark theme if there's an error
      document.body.classList.add("dark-theme");
      document.body.classList.remove("light-theme");
    }
  }
}

// Initialize the file manager when DOM is loaded
let fileManager;
document.addEventListener("DOMContentLoaded", () => {
  fileManager = new AdvancedFileManager();
  fileManager.initializeTheme();
});