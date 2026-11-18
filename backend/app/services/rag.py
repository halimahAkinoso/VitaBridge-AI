"""RAG — LangChain + pgvector. Approved clinical knowledge only. MVP: in-memory knowledge base, swap to pgvector in prod."""
KNOWLEDGE=[
 {"topic":"well_child","text":"Well-Child Visits: 14 visits 1mo-6y. Track growth, milestones, immunization, hearing, vision. Early support works best."},
 {"topic":"moca","text":"MoCA: cognitive screening, not diagnosis. Adjust for language, education, hearing, vision, mood, sleep. Re-check vs baseline."},
 {"topic":"hearing","text":"Hearing loss affects cognition, mood, social connection. Hearing follow-up improves cognitive scores and quality of life."},
 {"topic":"sleep","text":"Poor sleep mimics memory problems. 7-8h, regular routine, screen for apnea if snoring."},
 {"topic":"prevention","text":"Modifiable brain health factors: sleep, activity, hearing, BP, mood, social connection, nutrition."},
]
def retrieve(query: str, top_k=3):
    q=query.lower(); scored=sorted(KNOWLEDGE, key=lambda k: sum(w in k["text"].lower() for w in q.split()), reverse=True)
    return scored[:top_k]
