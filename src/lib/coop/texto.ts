// "São José" → "sao jose": para procurar sem ligar para acento e maiúscula.
export const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
