import { Colors } from '@/constants/theme';
import type { AvoScoreGrade } from '@/utils/avoScore';

type ThemeColors = typeof Colors.light | typeof Colors.dark;

export function getAvoScoreGradeColor(grade: AvoScoreGrade, colors: ThemeColors): string {
  switch (grade) {
    case 'A':
      return colors.gradeA;
    case 'B':
      return colors.gradeB;
    case 'C':
      return colors.gradeC;
    case 'D':
      return colors.gradeD;
    case 'F':
    default:
      return colors.gradeF;
  }
}
