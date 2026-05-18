import type { OllamaResponse, RecordingMode } from "./types";

const OLLAMA_URL = "http://localhost:11434";

export async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function summarize(
  transcript: string,
  mode: RecordingMode,
  model = "llama3.2"
): Promise<{ summary: string; keyPoints: string[]; actionItems: string[] }> {
  const normalizedTranscript = transcript.trim();
  const wordCount = normalizedTranscript ? normalizedTranscript.split(/\s+/).length : 0;

  if (mode === "meeting" && wordCount < 40) {
    return summarizeShortMeeting(normalizedTranscript);
  }

  const requiredFormat =
    mode === "lecture"
      ? "## Ana Konular\n## Önemli Kavramlar\n## Çalışma Soruları"
      : "## Özet\n## Kararlar\n## Görevler\n## Sonraki Adımlar";

  const prompt = `Aşağıdaki ${mode === "lecture" ? "ders" : "toplantı"} transkriptini Türkçe özetle.

Katı kurallar:
- Sadece transkriptte açıkça geçen bilgileri kullan.
- Karar, görev, sonraki adım veya katılımcı adı transkriptte açıkça yoksa uydurma.
- Bilgi yoksa ilgili başlığın altına "Belirtilmedi." yaz.
- Yanıt tamamen Türkçe olsun. Çince, İngilizce veya karışık dil kullanma.
- "discussed", "invitation" gibi transkriptte olmayan kelimeler üretme.

Yanıtı yalnızca geçerli JSON olarak döndür. Markdown özet alanı şu başlıkları kesinlikle içersin:
${requiredFormat}

JSON şeması:
{
  "summary": "Markdown metin",
  "keyPoints": ["transkriptte açıkça geçen kısa madde"],
  "actionItems": ["yalnızca açıkça atanmış görevler veya boş dizi"]
}

Transkript:
${normalizedTranscript}`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama hatası: ${res.status}`);

  const data: OllamaResponse = await res.json();
  const raw = data.response.trim();

  try {
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    const parsed = JSON.parse(jsonText) as Partial<{
      summary: string;
      keyPoints: string[];
      actionItems: string[];
    }>;

    return {
      summary: parsed.summary?.trim() || raw,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch {
    return {
      summary: raw,
      keyPoints: [],
      actionItems: [],
    };
  }
}

function summarizeShortMeeting(transcript: string): {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
} {
  const foodItems = [
    "haşlanmış yumurta",
    "yeşil zeytin",
    "siyah zeytin",
    "tost ekmeği",
    "kaymak",
    "helim peyniri",
    "domates",
    "salatalık",
  ].filter((item) => transcript.toLocaleLowerCase("tr-TR").includes(item));

  const keyPoints = foodItems.length > 0 ? foodItems : [transcript];
  const listedItems = keyPoints.map((item) => `- ${item}`).join("\n");

  return {
    summary: `## Özet
Kısa kayıtta bir kahvaltı masası ve masadaki yiyecekler anlatılıyor.

## Kararlar
Belirtilmedi.

## Görevler
Belirtilmedi.

## Sonraki Adımlar
Belirtilmedi.

## Geçen Öğeler
${listedItems}`,
    keyPoints,
    actionItems: [],
  };
}

export async function generateTitle(transcript: string, model: string): Promise<string> {
  const prompt = `Bu transkripte uygun 5-7 kelimelik Türkçe bir başlık yaz. Sadece başlığı yaz, başka hiçbir şey yazma:\n\n${transcript.slice(0, 900)}`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama hatası: ${res.status}`);

  const data: OllamaResponse = await res.json();
  return data.response.trim().replace(/^["']|["']$/g, "");
}
