/**
 * Education, work experience, skills, certifications and additional emergency contacts have NO backend endpoint
 * (see docs/backend-api-integration.md → Missing APIs). They are kept in this browser's localStorage, per employee id,
 * and the UI says so. Replace this module with real API calls if/when `/employees/:id/qualifications` is added.
 */
export interface EducationRecord {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: number;
  endYear: number | null;
}
export interface ExperienceRecord {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}
export interface Qualifications {
  education: EducationRecord[];
  experience: ExperienceRecord[];
  skills: { name: string; level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' }[];
  certifications: { name: string; issuer: string; year: number }[];
  extraEmergencyContacts: { name: string; phone: string; relation: string }[];
}

export const emptyQualifications = (): Qualifications => ({
  education: [],
  experience: [],
  skills: [],
  certifications: [],
  extraEmergencyContacts: [],
});

const key = (employeeId: number) => `ems.qualifications.${employeeId}`;

export const qualificationsStore = {
  load(employeeId: number): Qualifications {
    try {
      const raw = localStorage.getItem(key(employeeId));
      return raw
        ? { ...emptyQualifications(), ...(JSON.parse(raw) as Partial<Qualifications>) }
        : emptyQualifications();
    } catch {
      return emptyQualifications();
    }
  },
  save(employeeId: number, value: Qualifications) {
    try {
      localStorage.setItem(key(employeeId), JSON.stringify(value));
    } catch {
      /* storage full/unavailable */
    }
  },
};
