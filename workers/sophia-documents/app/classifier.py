import re


KEYWORDS = {
    "contrato": ("contrato", "contratante", "contratada"),
    "proposta": ("proposta", "orcamento", "orçamento"),
    "matricula": ("matricula", "matrícula"),
    "CAR": ("car", "cadastro ambiental rural"),
    "CCIR": ("ccir",),
    "ITR": ("itr",),
    "SIGEF": ("sigef",),
    "memorial_descritivo": ("memorial descritivo",),
    "laudo": ("laudo", "parecer técnico"),
    "procuracao": ("procuracao", "procuração"),
    "documento_pessoal": ("cpf", "rg", "identidade"),
    "comprovante": ("comprovante",),
}


def classify(filename: str, text: str) -> tuple[str, float]:
    haystack = f"{filename} {text[:5000]}".lower()
    for label, words in KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(word.lower())}\b", haystack) for word in words):
            return label, 0.82 if text else 0.65
    return "outro", 0.45
