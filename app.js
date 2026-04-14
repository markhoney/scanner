const { createApp } = Vue;

createApp({
  data() {
    return {
      scanner: null,
      isScanning: false,
      statusMessage: "Tap Start Scan to begin.",
      errorMessage: "",
      results: [],
      autoSubmit: false,
      apiEndpoint: "",
      cooldownMs: 2500,
      lastSeenCodes: {},
      deferredInstallPrompt: null,
      canInstall: false,
      showInstallUi: false
    };
  },
  mounted() {
    window.addEventListener("beforeinstallprompt", this.captureInstallPrompt);
    window.addEventListener("appinstalled", this.onInstalled);

    this.showInstallUi = true;
  },
  methods: {
    async startScanner() {
      if (this.isScanning) {
        return;
      }

      this.errorMessage = "";
      this.statusMessage = "Requesting camera access...";

      try {
        if (!this.scanner) {
          this.scanner = new Html5Qrcode("reader");
        }

        const formats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR
        ];

        await this.scanner.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const side = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
              return { width: side, height: side };
            },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            formatsToSupport: formats
          },
          (decodedText, decodedResult) => {
            const codeType = decodedResult?.result?.format?.formatName || "UNKNOWN";
            this.handleDecoded(decodedText, codeType);
          },
          () => {
            // Ignore decode errors while scanning; these are expected frame-to-frame.
          }
        );

        this.isScanning = true;
        this.statusMessage = "Scanning now. Hold code steady in frame.";
      } catch (error) {
        this.errorMessage = this.formatError(error);
        this.statusMessage = "";
      }
    },

    async handleDecoded(text, format) {
      const accepted = this.shouldAcceptScan(text, format);
      if (!accepted) {
        return;
      }

      this.emitFeedback();
      const item = this.addResult(text, format);

      if (this.autoSubmit && this.apiEndpoint) {
        await this.submitScan(item);
      }
    },

    shouldAcceptScan(text, format) {
      const cooldown = Number.isFinite(this.cooldownMs) ? this.cooldownMs : 2500;
      const safeCooldown = Math.max(500, cooldown);
      const key = `${format}|${text}`;
      const now = Date.now();
      const last = this.lastSeenCodes[key] || 0;

      if (now - last < safeCooldown) {
        return false;
      }

      this.lastSeenCodes[key] = now;
      return true;
    },

    emitFeedback() {
      if (navigator.vibrate) {
        navigator.vibrate(70);
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }

      try {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "triangle";
        osc.frequency.value = 880;

        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.13);
        osc.onended = () => audioCtx.close();
      } catch (_error) {
        // Ignore feedback errors since scan itself succeeded.
      }
    },

    async stopScanner() {
      if (!this.scanner || !this.isScanning) {
        return;
      }

      try {
        await this.scanner.stop();
        await this.scanner.clear();
      } catch (error) {
        this.errorMessage = this.formatError(error);
      } finally {
        this.isScanning = false;
        this.statusMessage = "Camera stopped.";
      }
    },

    addResult(text, format) {
      const duplicate = this.results[0]?.text === text && this.results[0]?.format === format;
      if (duplicate) {
        return this.results[0];
      }

      const item = {
        id: crypto.randomUUID(),
        text,
        format,
        time: new Date().toLocaleTimeString(),
        submitState: "idle",
        submitMessage: this.autoSubmit ? "Waiting to submit..." : "Captured locally"
      };

      this.results.unshift(item);

      if (this.results.length > 10) {
        this.results.pop();
      }

      return item;
    },

    async submitScan(item) {
      if (!this.apiEndpoint) {
        return;
      }

      item.submitState = "pending";
      item.submitMessage = "Submitting...";

      try {
        const response = await fetch(this.apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            code: item.text,
            format: item.format,
            scannedAt: new Date().toISOString()
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        item.submitState = "ok";
        item.submitMessage = "Submitted";
      } catch (error) {
        item.submitState = "error";
        item.submitMessage = "Submit failed";
        this.errorMessage = this.formatError(error);
      }
    },

    captureInstallPrompt(event) {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      this.canInstall = true;
    },

    async installApp() {
      if (!this.deferredInstallPrompt) {
        return;
      }

      this.deferredInstallPrompt.prompt();
      await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      this.canInstall = false;
    },

    onInstalled() {
      this.deferredInstallPrompt = null;
      this.canInstall = false;
      this.statusMessage = "App installed. You can launch it from your home screen.";
    },

    formatError(error) {
      const msg = typeof error === "string" ? error : error?.message;
      return msg || "Unable to start scanner. Check camera permission and HTTPS access.";
    }
  },
  beforeUnmount() {
    window.removeEventListener("beforeinstallprompt", this.captureInstallPrompt);
    window.removeEventListener("appinstalled", this.onInstalled);
    this.stopScanner();
  }
}).mount("#app");
