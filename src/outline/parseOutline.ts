export interface OutlineSection {
  number: string;
  title: string;
  subsections: { number: string; title: string }[];
}

export function parseOutline(payload: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const byNumber = new Map<string, OutlineSection>();

  for (const line of payload.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+(.+)$/);
    if (!match) continue;

    const [, number, title] = match;
    const [sectionNumber] = number.split('.');
    if (number === sectionNumber) {
      const section: OutlineSection = { number, title, subsections: [] };
      byNumber.set(number, section);
      sections.push(section);
    } else {
      byNumber.get(sectionNumber)?.subsections.push({ number, title });
    }
  }

  return sections;
}
