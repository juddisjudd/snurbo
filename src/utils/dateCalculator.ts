export class DateCalculator {
  static calculateDaysUntil(targetDate: string | Date): number {
    const now = new Date();
    const target =
      typeof targetDate === "string" ? new Date(targetDate) : targetDate;

    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate()
    );

    const diffTime = targetStart.getTime() - nowStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  static calculateDaysUntilHoliday(holiday: string): number | null {
    const now = new Date();
    const currentYear = now.getFullYear();

    const holidays: Record<string, string> = {
      "july 4th": `${currentYear}-07-04`,
      "july 4": `${currentYear}-07-04`,
      "4th of july": `${currentYear}-07-04`,
      "independence day": `${currentYear}-07-04`,
      christmas: `${currentYear}-12-25`,
      "new year": `${currentYear + 1}-01-01`,
      "new years": `${currentYear + 1}-01-01`,
      thanksgiving: `${currentYear}-11-28`,
      halloween: `${currentYear}-10-31`,
      valentine: `${currentYear}-02-14`,
      valentines: `${currentYear}-02-14`,
      "memorial day": `${currentYear}-05-26`,
      "labor day": `${currentYear}-09-01`,
    };

    const normalizedHoliday = holiday.toLowerCase().trim();
    const holidayDate = holidays[normalizedHoliday];

    if (!holidayDate) {
      return null;
    }

    const days = this.calculateDaysUntil(holidayDate);

    if (days < 0) {
      const nextYearDate = holidayDate.replace(
        currentYear.toString(),
        (currentYear + 1).toString()
      );
      return this.calculateDaysUntil(nextYearDate);
    }

    return days;
  }

  static formatDateContext(query: string): string | null {
    const now = new Date();
    const dateQueries = [
      /how many days? (?:until|till|to) (.+)/i,
      /when is (.+)/i,
      /days? (?:until|till|to) (.+)/i,
      /how long (?:until|till|to) (.+)/i,
    ];

    for (const pattern of dateQueries) {
      const match = query.match(pattern);
      if (match) {
        const target = match[1].trim();

        const holidayDays = this.calculateDaysUntilHoliday(target);
        if (holidayDays !== null) {
          return `Date calculation: From ${now.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })} to ${target}, there are exactly ${holidayDays} days.`;
        }

        try {
          const targetDate = new Date(target);
          if (!isNaN(targetDate.getTime())) {
            const days = this.calculateDaysUntil(targetDate);
            return `Date calculation: From ${now.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })} to ${targetDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}, there are exactly ${days} days.`;
          }
        } catch {}
      }
    }

    return null;
  }
}
