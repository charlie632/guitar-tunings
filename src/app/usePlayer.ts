import { useEffect, useState } from "react";
import { createPlayer, type Player } from "../audio/player";

/** One Player per app. Its AudioContext is only created on the first pluck, after a user gesture. */
export function usePlayer(): Player {
  const [player] = useState(createPlayer);
  useEffect(() => () => player.stop(), [player]);
  return player;
}
