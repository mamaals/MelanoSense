export type Scan = {
    id: string;
    user_id: string;
    patient_name: string | null;
    image_url: string | null;
    asymmetry: string | null;
    border: string | null;
    color: string | null;
    diameter: string | null;
    status: string;
    diagnosis: string | null;
    stage: string | null;
    confidence: number | null;
    recomendation: string | null;
    device_uid: string | null;    
    created_at: string;
}

export type ScanHistoryItem = Pick<Scan, 'id' | 'created_at' | 'status' | 'stage' | 'confidence'>;
