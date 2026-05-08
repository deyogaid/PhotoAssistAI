# PhotoAssist AI 📸✨

**PhotoAssist AI** adalah asisten cerdas berbasis kecerdasan buatan (AI) yang dirancang khusus untuk fotografer profesional dan pembuat konten. Aplikasi ini membantu Anda melakukan analisis foto secara mendalam, menyiapkan instruksi (prompt) perbaikan foto secara otomatis, dan memberikan rekomendasi gaya sinematik hanya dalam hitungan detik.

Lupakan kerumitan membuat prompt manual. Dengan **PhotoAssist AI**, produktivitas Anda meningkat maksimal dengan hasil pengeditan yang tetap presisi.

---

## 🚀 Keunggulan Utama

- **Efisiensi Tanpa Batas**: Cocok untuk pengguna yang "malas" menulis prompt panjang. AI melakukan pekerjaan berat untuk Anda.
- **Analisis Mendalam**: Deteksi otomatis kondisi pencahayaan, komposisi, dan subjek foto.
- **AI Integration Hub (GPT Auth)**: Hubungkan API Key privat Anda (OpenAI, OpenRouter, Together AI) untuk akses tanpa batas dan performa yang lebih cepat.
- **Preset Sinematik**: Pilihan gaya (Film Noir, Moody Orange/Teal, Cyberpunk, dll) yang siap diaplikasikan.

---

## ✨ Fitur-Fitur Utama

1.  **Smart Image Analysis**: Unggah foto dan biarkan Gemini AI menganalisa kekurangan dan kelebihan foto tersebut.
2.  **Auto-Prompt Preparation**: Menghasilkan instruksi pengeditan yang sangat detail (lighting, color grading, retouching) berdasarkan hasil analisa.
3.  **Visual Enhancement Generator**: Pratinjau hasil perbaikan foto menggunakan model AI terbaru.
4.  **GPT Auth Integration**: Kelola kunci API Anda secara lokal di browser untuk keamanan dan kebebasan penggunaan layanan AI pihak ketiga.
5.  **Multi-Model Support**: Mendukung Gemini Pro Vision, GPT-4o, dan model open-source lainnya melalui router AI yang cerdas.

---

## 🛠️ Cara Kerja

1.  **Upload**: Pilih foto yang ingin Anda tingkatkan kualitasnya.
2.  **Analyze**: Klik tombol analisa. Sistem akan mendeteksi tipe foto (Portrait, Landscape, Street, dll) dan kondisi teknisnya.
3.  **Refine**: AI akan menyarankan perbaikan. Anda bisa menambahkan arahan tambahan jika diperlukan.
4.  **Result**: Dapatkan prompt profesional yang bisa Anda gunakan di software editing atau langsung generate hasil visualnya di aplikasi.

---

## 📦 Instalasi & Persiapan

Untuk menjalankan aplikasi ini secara lokal, ikuti langkah-langkah berikut:

### Prasyarat
- Node.js (versi 18 atau lebih baru)
- npm atau yarn

### Langkah-langkah
1.  **Clone atau Unduh Source Code**.
2.  **Install Dependensi**:
    ```bash
    npm install
    ```
3.  **Konfigurasi Environment**:
    Buat file `.env` di root direktori (atau salin dari `.env.example`) dan masukkan API Key Anda:
    ```env
    GEMINI_API_KEY="kunci-api-gemini-anda"
    OPENAI_API_KEY="kunci-api-openai-anda" (opsional)
    ```
4.  **Jalankan Server Development**:
    ```bash
    npm run dev
    ```
5.  **Akses Aplikasi**: Buka `http://localhost:3000` di browser Anda.

---

## 💡 Cara Penggunaan

1.  **Buka Aplikasi**: Di halaman utama, Anda akan melihat area drop-zone untuk foto.
2.  **Unggah Foto**: Klik atau drag-and-drop foto Anda.
3.  **Atur Konfigurasi**: Pilih tipe foto dan gaya yang diinginkan di panel sebelah kanan.
4.  **Gunakan GPT Auth**: Jika kuota publik habis, masuk ke menu **"GPT Auth"** di header, lalu masukkan API Key OpenAI atau OpenRouter Anda untuk melanjutkan akses tanpa gangguan.
5.  **Unduh Hasil**: Salin prompt yang dihasilkan atau simpan hasil generate gambar untuk referensi editing Anda.

---

## 🏗️ Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Framer Motion (Animations).
- **Icons**: Lucide React.
- **AI Engine**: Google Gemini Pro Vision, OpenAI GPT-4o, OpenRouter API.
- **Database**: Firebase Firestore (untuk sinkronisasi data).
- **Styling**: Modern minimalis dengan sentuhan sinematik.

---

## 🔐 Keamanan & Privasi

Privasi data Anda adalah prioritas kami. Semua API Key yang Anda masukkan melalui fitur **GPT Auth** disimpan secara lokal di browser Anda (`localStorage`) dan tidak pernah dikirim atau disimpan di server kami.

---

© 2026 **PhotoAssist AI**. Built for Professional Photographers.
