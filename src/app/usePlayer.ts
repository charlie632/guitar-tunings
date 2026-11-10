import { useEffect, useState } from "react";
import { createPlayer, type Player } from "../audio/player";

export function usePlayer(): Player {
  const [player] = useState(createPlayer);
  useEffect(() => () => player.stop(), [player]);
  return player;
}
