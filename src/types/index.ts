export interface SuburbStat {
  name: string;
  state: string;
  searches: number;
  competition: string;
  gbpStatus: string;
}

export interface Scorecard {
  googleLocalPack: number;
  chatgptAeoVisibility: number;
  mobileLeadConversion: number;
  citationVelocity: number;
}

export interface SuburbStats {
  monthlyEmergencySearches: number;
  typicalJobValue: string;
  competitionLevel: string;
  aeoOpportunityScore: number;
}

export interface AeoPreview {
  userQuery: string;
  chatgptResponseSimulation: string;
  criticalAeoGap: string;
}

export interface ScanResult {
  suburbName: string;
  suburbStats: SuburbStats;
  aeoPreview: AeoPreview;
  scorecard: Scorecard;
  quickWins: string[];
  savingsEstimation: {
    wastedPpcBudget: string;
    potentialOrganicLeads: string;
  };
}

export interface SimulationLead {
  id: string;
  customerName: string;
  suburb: string;
  phone: string;
  urgentIssue: string;
  source: string;
  revenueEstimate: string;
  status: string;
  timestamp: string;
}

export interface ConsultationBooking {
  id?: string;
  businessName: string;
  suburb: string;
  phone?: string;
  email: string;
  contactName: string;
  tradeType: string;
  bookingDate?: string;
  bookingTime?: string;
  createdAt?: string;
  status?: string;
}
