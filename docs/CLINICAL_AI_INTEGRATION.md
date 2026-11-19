# Clinical AI Integration: Abu Dhabi MVP

## Safety and deployment boundary

This change adds local, consent-gated processing interfaces and an audit
record. It does not contain UAE-validated model weights, a clinician-labelled
training cohort, a Malaffi connection, or an Azure subscription deployment.
Speech and EEG measurements are descriptive only. No model assigns a
patient-facing cognitive score, risk level, or referral.

Do not use the Render demo or any non-UAE resource for identifiable health
data. The root `Dockerfile` and Render Blueprint are intentionally unchanged;
the Python 3.13 image for the Azure staging path is `backend/Dockerfile`.
`docker-compose.yml` runs that image and requires an externally managed UAE
PostgreSQL URL and secrets. Compose does not create Azure resources and does
not prove that a supplied endpoint is in UAE Central.

## Seven selected model layers

The cap is interpreted as seven deployment layers; paired encoders within a
layer are kept only where the bilingual or multimodal requirement needs them.
They are not seven validated clinical models.

| Layer | Select | Drop / trade-off |
|---|---|---|
| Clinical text | CAMeLBERT-Mix for Arabic and Bio_ClinicalBERT for English | CAMeLBERT includes Arabic dialect varieties but is not validated for Emirati clinical feature extraction. Bio_ClinicalBERT was trained on US MIMIC-III notes, not Abu Dhabi patient language. In this MVP, an explicit bilingual phrase ontology extracts only stated facts; neither encoder is allowed to create a health finding. |
| Nura | GPT-4o-mini through Azure OpenAI only after a UAE Central deployment and contractual/data-residency review; keep the current local, deterministic Nura until then | Do not route health context to the US OpenAI API. Confirm exact model/region availability in the Azure portal before deployment; a UAE resource region label alone is not proof of processing location. |
| Risk/explainability | XGBoost with SHAP explanations for clinician review | Do not train on synthetic demo records. A locally validated model artifact is required. SHAP shows model attribution, not causation or a clinical explanation by itself. |
| Speech | Whisper-large-v3 for Arabic/English transcription, with AraBERT for Arabic and RoBERTa for English only after task-specific local validation | Large-v3 is multilingual but resource-intensive; CPU latency is high. ASR, pauses, and transcript features are not a dementia score. The current service returns no cognitive score or word-finding classification. |
| EEG | LaBraM embeddings with EEGNet as the small downstream model, only after montage/protocol and local validation are fixed | The repositories provide research models, not a validated Abu Dhabi dementia test. Current code validates EDF inputs, filters the signal, and reports descriptive band power; no LaBraM or EEGNet checkpoint is loaded. |
| Sleep | YASA for clinician-acquired polysomnography EEG in a later pilot | Do not apply YASA to ordinary watch metrics. MOMENT is a general time-series foundation model and DeepSleepNet still needs task-specific validation; neither justifies a current patient risk label. |
| MRI | No MRI model in the MVP; use clinician-authored MRI report text, if consented and available | Drop MEMOIR-VLM and a custom 3D-CNN until there is an approved local imaging cohort, protocol, compute budget, and radiology governance. |

Model references:

- [CAMeLBERT-Mix model card](https://huggingface.co/CAMeL-Lab/bert-base-arabic-camelbert-mix)
- [Bio_ClinicalBERT model card](https://huggingface.co/emilyalsentzer/Bio_ClinicalBERT)
- [OpenAI Whisper repository and model card](https://github.com/openai/whisper)
- [LaBraM research repository](https://github.com/935963004/LaBraM)
- [Microsoft Foundry model and regional availability documentation](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure)

## Evidence flow and candidate study weights

```text
Consent + authenticated user
  -> bilingual explicit-feature extraction (Arabic / English)
  -> optional local Whisper transcription and pause timing
  -> optional EDF format validation, theta/alpha and alpha power
  -> saved measurements, sleep, hearing/vision, function, language and MoCA
  -> evidence snapshot + missing-data/source labels (no active weighted score)
  -> clinician review -> clinician-entered STABLE / WATCH / ACT / REFER + risk
  -> Nura explains only saved evidence and the clinician's next step
  -> Doctor Dashboard shows evidence provenance, audit event and (only for an
     approved model) SHAP attribution
```

For a prospective adult validation study only, the code records these
hypothesis weights: MoCA 30%, speech 20%, EEG 20%, sleep 15%, and hearing/vision
15%. They are not used in `fuse_risk`. Hearing and vision receive substantial
weight because they can confound cognitive and speech testing; language,
education, mood, sleep, function, and test conditions must be model covariates
and stratification variables, not post-hoc excuses. BP, glucose, cholesterol,
weight, and activity remain contextual predictors. These weights need
clinician agreement, prospective calibration, subgroup validation (including
Arabic/English), and regulatory review before any score or threshold is shown.

## Implemented endpoints

All endpoints require JWT authentication. Nura overview, plan, chat, nudge,
and proactive recommendations are audited as well. Inference audit rows
contain a keyed input digest, output digest, user, operation, model identifier,
result code, timestamp, and a structured non-verbatim explanation/provenance
record; raw text and uploaded audio/EEG are not written to the audit table.
Uploads require explicit consent, are limited in size, and use a temporary
file that is removed after processing.
Set `AUDIT_HMAC_KEY` separately from `JWT_SECRET` in the UAE deployment.
The new `/api/nlp`, `/api/speech`, `/api/eeg`, and `/api/risk` endpoints fail
closed unless `CLINICAL_AI_ENABLED=true` and `DATA_RESIDENCY_REGION=uaecentral`.
These settings are safeguards, not proof of actual cloud resource location.

- `POST /api/nlp/extract`: explicit English/Arabic phrase features; absent
  answers remain `null`. Adult baseline saves these features alongside
  self-reported notes; the notes themselves are not repeated in assessment
  history responses.
- `POST /api/speech/analyze`: local Whisper only when
  `SPEECH_MODEL_ENABLED=true` and `WHISPER_MODEL_PATH` points to a locally
  stored approved checkpoint. Transcript and pause timing only.
- `POST /api/eeg/analyze`: EDF format validation, preprocessing, and descriptive
  band-power features only.
- `POST /api/risk/fuse`: clinician/admin-only evidence summary. Without an
  authorized clinician review, response is always `NOT_ASSESSED`.

The risk-model loader requires a checksum-matched artifact and an approval
manifest naming an approved Abu Dhabi validation protocol. Its manifest digest
must also be pinned in protected `VALIDATED_MODEL_MANIFEST_SHA256` deployment
configuration. No demo-data training or default score is provided. Nura's
bilingual system prompt is in `backend/app/services/agent.py`; the running chat
remains local and does not send health context to an LLM.

## Before any real-patient pilot

1. Provision the UAE Central Container Apps environment, private networking,
   UAE PostgreSQL, key management, and UAE-resident audit/monitoring resources.
2. Verify each resource's actual region, network route, backup/replica region,
   retention, encryption, operator access, and processor contract. Do not rely
   on `AZURE_REGION` in Compose as proof.
3. Complete DoH/ADHICS/privacy review, clinical safety case, consent language,
   ethics approvals, model cards, subgroup validation, clinician workflow,
   incident response, and retention/deletion policy.
4. Confirm Malaffi API/FHIR contract, consent scopes, sandbox access, and
   data-sharing approval before enabling any read/write integration.
5. Keep clinician review as the decision point. Model and Nura outputs are
   assistive, auditable, and reversible.

## Rollout

1. **Bilingual MVP:** deploy the local phrase extractor, Whisper transcription
   only after a UAE-local checkpoint and consent workflow are ready, and the
   gated XGBoost/SHAP interfaces in UAE Central. Validate Arabic and English
   feature extraction with clinicians; keep fusion `NOT_ASSESSED`.
2. **Clinical pilot:** at one SEHA site, prospectively validate with 50 adults
   and 50 children only after approvals. Treat child visits as the separate
   UAE/MOHAP well-child and bilingual developmental pathway, not adult
   dementia scoring. Add LaBraM/EEGNet and YASA only if acquisition protocol,
   consent, and local validation support them.
3. **Malaffi-ready integration:** after the API/FHIR contract, scopes, and
   consent are approved, test read-only BP/lab/imaging-report/growth ingestion
   first. Any prevention-plan write-back needs a separately approved workflow
   and clinician confirmation. Position the app as a prevention layer, not a
   replacement for Malaffi or Ossi.
