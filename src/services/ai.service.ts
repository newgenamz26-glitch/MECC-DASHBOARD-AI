import { Injectable, inject } from '@angular/core';
import { StateService } from './state.service';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

export interface Facility {
  nama: string;
  jenis: 'Hospital' | 'Klinik';
  jarak: string;
  status?: string;
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

    const systemInstruction = `Anda adalah pakar sistem maklumat geografi (GIS) untuk perkhidmatan kecemasan. Peranan utama anda adalah untuk memproses koordinat GPS dan memberikan data lokasi yang paling tepat, terutamanya jarak perjalanan melalui jalan raya. Ketepatan adalah keutamaan mutlak.`;

    const prompt = `Tugas Kritikal: Anda adalah sistem navigasi kecemasan. Berdasarkan lokasi GPS semasa yang sangat tepat di latitud ${latitude}, longitud ${longitude} (ketepatan dalam lingkungan ${accuracy.toFixed(1)} meter), cari fasiliti perubatan terdekat. PENTING: Anda MESTI mengira jarak berdasarkan LALUAN JALAN RAYA SEBENAR menggunakan data pemetaan masa nyata (seperti Peta Google). JANGAN sesekali menggunakan jarak garis lurus (straight-line distance). Senarai perlu diisih mengikut jarak perjalanan jalan raya yang paling dekat dahulu. Senaraikan hospital dan klinik (kerajaan dan swasta). Untuk setiap fasiliti, berikan: nama penuh, jenis ('Hospital' atau 'Klinik'), jarak perjalanan jalan raya yang tepat dalam kilometer (km), dan status operasi (contohnya, "Buka 24 jam").`;

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nama: {
            type: Type.STRING,
            description: 'Nama penuh hospital atau klinik.',
          },
          jenis: {
            type: Type.STRING,
            description: "Jenis fasiliti, sama ada 'Hospital' atau 'Klinik'.",
          },
          jarak: {
            type: Type.STRING,
            description: 'Jarak perjalanan jalan raya yang tepat dari lokasi semasa, dalam format "X.X km" atau "XXX m".',
          },
          status: {
            type: Type.STRING,
            description: 'Status operasi fasiliti (cth: "Buka 24 Jam", "Tutup Ahad").'
          }
        },
        required: ['nama', 'jenis', 'jarak'],
      },
    };

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const responseText = response.text.trim();
      
      // Basic check if the response is a valid JSON array
      if (responseText.startsWith('[') && responseText.endsWith(']')) {
         const facilities = JSON.parse(responseText) as Facility[];
         return facilities;
      } else {
        console.error('AI returned a non-array JSON response:', responseText);
        throw new Error('AI tidak memberikan respons yang sah. Sila cuba lagi.');
      }

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ralat tidak diketahui berlaku semasa menghubungi AI.';
      throw new Error(`Gagal mendapatkan data dari AI: ${errorMessage}`);
    }
  }
}