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
  recommendation: string | null;
  device_uid: string | null;
  created_at: string;
};

export type ScanHistoryItem = Pick<
  Scan,
  'id' | 'created_at' | 'status' | 'diagnosis'
>;

export type ScanDetail = Pick<
  Scan,
  | 'id'
  | 'user_id'
  | 'image_url'
  | 'asymmetry'
  | 'border'
  | 'color'
  | 'diameter'
  | 'status'
  | 'diagnosis'
  | 'stage'
  | 'confidence'
  | 'recommendation'
>;

export type ScanObservation = Pick<
  Scan,
  | 'id'
  | 'user_id'
  | 'created_at'
  | 'status'
>;
