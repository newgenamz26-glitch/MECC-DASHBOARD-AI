import { Injectable, inject } from '@angular/core';
import { StateService } from './state.service';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface Facility {
  nama: string;
  jenis: 'Hospital' | 'Klinik';
  jarak: string;
  status?: string;
  googleMapsPlaceId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private stateSvc = inject(StateService);
  private ai: GoogleGenAI;

  constructor() {
    // This is safe because process.env.API_KEY is handled by the execution environment.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async findNearbyMedicalFacilities(): Promise<Facility[]> {
    const currentPosition = this.stateSvc.currentPosition();
    if (!currentPosition) {
      throw new Error('Lokasi semasa tidak tersedia. Pastikan GPS diaktifkan dan kebenaran telah diberikan.');
    }

    const { latitude, longitude, accuracy } = currentPosition;

    const systemInstruction = `Anda adalah pakar sistem maklumat geografi (GIS) untuk perkhidmatan kecemasan. Peranan utama anda adalah untuk memproses koordinat GPS dan memberikan data lokasi yang paling tepat, terutamanya jarak perjalanan melalui jalan raya, menggunakan data Google Maps. Ketepatan adalah keutamaan mutlak.`;

    const prompt = `
      Tugas Kritikal: Anda adalah sistem navigasi kecemasan. Berdasarkan lokasi GPS semasa di latitud ${latitude}, longitud ${longitude} (ketepatan dalam lingkungan ${accuracy.toFixed(1)} meter), cari fasiliti perubatan terdekat (hospital dan klinik, kerajaan dan swasta).
      
      PENTING:
      1. Gunakan data Google Maps untuk mendapatkan maklumat yang paling tepat dan terkini.
      2. Kira jarak berdasarkan LALUAN JALAN RAYA SEBENAR. JANGAN gunakan jarak garis lurus.
      3. Isih senarai mengikut jarak perjalanan jalan raya yang paling dekat dahulu.
      4. Berikan respons dalam format JSON array SAHAJA. Tiada teks atau markdown tambahan.
      
      Setiap objek dalam array mesti mempunyai kunci berikut:
      - "nama": Nama penuh dan rasmi fasiliti.
      - "jenis": Jenis fasiliti, sama ada 'Hospital' atau 'Klinik'.
      - "jarak": Jarak perjalanan jalan raya yang tepat dari lokasi semasa, dalam format "X.X km" atau "XXX m".
      - "status": Status operasi fasiliti (cth: "Buka 24 Jam", "Tutup Ahad"). Jika tidak diketahui, gunakan "N/A".
      - "googleMapsPlaceId": ID Tempat Google Maps untuk fasiliti tersebut.
    `;

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ googleMaps: {} }],
        },
      });

      let responseText = response.text.trim();
      
      // The model might wrap the JSON in ```json ... ```, so let's strip that.
      if (responseText.startsWith('```json')) {
        responseText = responseText.substring(7, responseText.length - 3).trim();
      }

      // Basic check if the response is a valid JSON array
      if (responseText.startsWith('[') && responseText.endsWith(']')) {
         const facilities = JSON.parse(responseText) as Facility[];
         return facilities;
      } else {
        console.error('AI returned a non-array JSON response:', responseText);
        throw new Error('AI tidak memberikan respons yang sah dalam format JSON yang dijangkakan. Sila cuba lagi.');
      }

    } catch (error) {
      console.error('Error calling Gemini API with Google Maps tool:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ralat tidak diketahui berlaku semasa menghubungi AI.';
      throw new Error(`Gagal mendapatkan data dari AI: ${errorMessage}`);
    }
  }
}