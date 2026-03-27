import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import * as schema from '@omr-prod/database';

@Injectable()
export class GradingService {
    constructor(
        @Inject('DATABASE_CONNECTION') private readonly db: any,
    ) { }

    /**
     * Performs authoritative grading of a student's OMR responses.
     * Calculates scores and generates detailed right/wrong breakdown.
     */
    async gradeScan(rawData: any, version: string = '2026-V1') {
        // rawData might be { answers: { math: ... } } OR { math: ... }
        const studentAnswers = rawData?.answers || rawData || {};
        const gradingDetails: any = {};
        let totalScore = 0;
        let maxPossibleScore = 0;

        for (const subject of Object.keys(studentAnswers)) {
            // Fetch official answer key
            const [key] = await this.db.select().from(schema.answerKeys)
                .where(and(
                    eq(schema.answerKeys.subject, subject),
                    eq(schema.answerKeys.version, version)
                ))
                .limit(1);

            if (!key) {
                // If key is missing, we still record the subject but with zero score
                console.warn(`⚠️  Grading Warning: No Answer Key found for Subject: ${subject}, Version: ${version}`);
                gradingDetails[subject] = {
                    score: 0,
                    total: 0,
                    error: 'MISSING_KEY'
                };
                continue;
            }

            const correctAnswers = key.answers as Record<string, string>;
            let subjectScore = 0;
            const subjectResults: Record<string, boolean> = {};

            Object.keys(correctAnswers).forEach(qNum => {
                const studentChoice = studentAnswers[subject]?.[qNum]?.answer;
                const isCorrect = studentChoice === correctAnswers[qNum];
                if (isCorrect) subjectScore++;
                subjectResults[qNum] = isCorrect;
            });

            gradingDetails[subject] = {
                score: subjectScore,
                total: Object.keys(correctAnswers).length,
                results: subjectResults,
                correctAnswers
            };

            totalScore += subjectScore;
            maxPossibleScore += Object.keys(correctAnswers).length;
        }

        return {
            totalScore,
            maxPossibleScore,
            gradingDetails
        };
    }
}
