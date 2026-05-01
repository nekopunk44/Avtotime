import { useEffect, useState } from 'react';
import { optimizeCloudinaryUrl } from '../utils/cloudinaryOptimizer';
import { getTicketQuestionLocalImageUrl } from '../utils/ticketLocalImages';

interface DrivingQuestionImageSource {
  ticketNumber?: number;
  questionNumber?: number;
  imageUrl?: string;
}

export const useDrivingQuestionImage = (question?: DrivingQuestionImageSource | null) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(() =>
    question?.imageUrl ? optimizeCloudinaryUrl(question.imageUrl) : undefined,
  );

  useEffect(() => {
    let isCancelled = false;

    if (!question) {
      setResolvedUrl(undefined);
      return () => {
        isCancelled = true;
      };
    }

    if (question.imageUrl) {
      setResolvedUrl(optimizeCloudinaryUrl(question.imageUrl));
      return () => {
        isCancelled = true;
      };
    }

    setResolvedUrl(undefined);

    void getTicketQuestionLocalImageUrl(question.ticketNumber, question.questionNumber).then((url) => {
      if (isCancelled) return;
      setResolvedUrl(url ? optimizeCloudinaryUrl(url) : undefined);
    });

    return () => {
      isCancelled = true;
    };
  }, [question?.imageUrl, question?.questionNumber, question?.ticketNumber]);

  return resolvedUrl;
};
