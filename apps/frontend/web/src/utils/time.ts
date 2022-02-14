export const formatSeconds = (currentSeconds: number) => {
  const fullMinutes = Math.floor(currentSeconds / 60);
  const remainingSeconds = Math.floor(currentSeconds - (fullMinutes * 60));
  const fullHours = Math.floor(fullMinutes / 60);
  const remainingMinutes = fullMinutes - (fullHours * 60);
  return `${fullHours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
