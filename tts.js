// tts.js - Verity Text-to-Speech
// Web Speech API, tuned per phase biar karakter Verity kerasa

const VerityTTS = (() => {
  let synth = window.speechSynthesis;
  let currentUtterance = null;
  let selectedVoice = null;

  // =====================
  // PHASE CONFIG
  // Setiap fase punya karakter suara beda
  // =====================
  const PHASE_CONFIG = {
    1: {
      pitch: 1.4,      // Tinggi, ceria
      rate: 1.15,      // Agak cepet, energik
      volume: 0.9,
      pauseChance: 0,  // Gak ada jeda aneh
      glitch: false,
    },
    2: {
      pitch: 1.1,      // Mulai turun dikit
      rate: 1.0,
      volume: 0.85,
      pauseChance: 0.15, // Kadang jeda sebentar mid-sentence
      glitch: false,
    },
    3: {
      pitch: 0.85,     // Lebih dalam, creepy
      rate: 0.9,       // Lebih lambat, berat
      volume: 0.8,
      pauseChance: 0.3,
      glitch: false,
    },
    4: {
      pitch: 0.6,      // Dalam banget, disturbing
      rate: 0.75,      // Lambat, berat
      volume: 0.75,
      pauseChance: 0.5,
      glitch: true,    // Efek glitch di suara
    },
  };

  // =====================
  // INIT VOICE
  // Pilih suara perempuan kalau ada
  // =====================
  function initVoice() {
    return new Promise((resolve) => {
      const trySelect = () => {
        const voices = synth.getVoices();
        if (!voices.length) return;

        // Prioritas: perempuan Indonesia > perempuan EN > apapun yang ada
        const preferred = [
          voices.find(v => v.lang === 'id-ID' && v.name.toLowerCase().includes('female')),
          voices.find(v => v.lang === 'id-ID'),
          voices.find(v => v.name.toLowerCase().includes('zira')),    // Windows female EN
          voices.find(v => v.name.toLowerCase().includes('samantha')),// Mac female EN
          voices.find(v => v.name.toLowerCase().includes('female')),
          voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('male')),
          voices[0],
        ];

        selectedVoice = preferred.find(v => v !== undefined) || voices[0];
        resolve(selectedVoice);
      };

      // Voice list kadang belum siap langsung
      if (synth.getVoices().length) {
        trySelect();
      } else {
        synth.onvoiceschanged = trySelect;
      }
    });
  }

  // =====================
  // BERSIHKAN TEKS
  // Hapus glitch char, simbol, emoji sebelum di-speak
  // =====================
  function cleanText(text) {
    return text
      .replace(/[̴̵̶̷̸]/g, '')           // Hapus combining chars (glitch effect)
      .replace(/[\u0300-\u036f]/g, '')    // Hapus diacritics
      .replace(/[^\w\s.,!?'-]/g, ' ')    // Hapus emoji & simbol aneh
      .replace(/\s+/g, ' ')
      .trim();
  }

  // =====================
  // EFEK GLITCH SUARA (fase 4)
  // Potong kalimat jadi chunk, tiap chunk delay random
  // =====================
  function speakGlitched(text, config) {
    const words = text.split(' ');
    const chunks = [];
    let current = [];

    // Potong per 3-5 kata
    words.forEach((word, i) => {
      current.push(word);
      if (current.length >= Math.floor(Math.random() * 3) + 3 || i === words.length - 1) {
        chunks.push(current.join(' '));
        current = [];
      }
    });

    let i = 0;
    function speakNext() {
      if (i >= chunks.length) return;
      const utter = new SpeechSynthesisUtterance(chunks[i]);
      utter.voice = selectedVoice;
      utter.pitch = config.pitch + (Math.random() * 0.4 - 0.2); // pitch random ±0.2
      utter.rate = config.rate + (Math.random() * 0.3 - 0.15);  // rate random
      utter.volume = config.volume;
      utter.onend = () => {
        i++;
        // Delay random antar chunk (efek glitch/patah2)
        const delay = Math.random() < 0.5 ? Math.random() * 600 : 0;
        setTimeout(speakNext, delay);
      };
      currentUtterance = utter;
      synth.speak(utter);
    }
    speakNext();
  }

  // =====================
  // SPEAK UTAMA
  // =====================
  async function speak(text, phase = 1) {
    if (!synth) return;

    // Stop kalau lagi ngomong
    stop();

    // Pastiin voice udah siap
    if (!selectedVoice) await initVoice();

    const config = PHASE_CONFIG[phase] || PHASE_CONFIG[1];
    const cleanedText = cleanText(text);

    if (!cleanedText) return;

    // Fase 4 pake efek glitch
    if (config.glitch) {
      speakGlitched(cleanedText, config);
      return;
    }

    // Fase 1-3: normal tapi dengan jeda aneh di fase 2-3
    let finalText = cleanedText;
    if (config.pauseChance > 0 && Math.random() < config.pauseChance) {
      // Sisipkan jeda di tengah kalimat
      const words = finalText.split(' ');
      const pauseAt = Math.floor(words.length / 2);
      words.splice(pauseAt, 0, '...');
      finalText = words.join(' ');
    }

    const utter = new SpeechSynthesisUtterance(finalText);
    utter.voice = selectedVoice;
    utter.pitch = config.pitch;
    utter.rate = config.rate;
    utter.volume = config.volume;

    currentUtterance = utter;
    synth.speak(utter);
  }

  // =====================
  // STOP
  // =====================
  function stop() {
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }
    currentUtterance = null;
  }

  // =====================
  // CEK SUPPORT
  // =====================
  function isSupported() {
    return 'speechSynthesis' in window;
  }

  // Init voice pas module dimuat
  if (isSupported()) initVoice();

  return { speak, stop, isSupported, initVoice };
})();

export default VerityTTS;
