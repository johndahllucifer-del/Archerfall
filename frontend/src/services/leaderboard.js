import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const submitScore = async (name, level, score) => {
  try {
    const { data } = await axios.post(`${API}/leaderboard/submit`, { name, level, score });
    return data;
  } catch (e) {
    console.error("submitScore failed", e);
    return null;
  }
};

export const fetchLeaderboard = async (limit = 100) => {
  try {
    const { data } = await axios.get(`${API}/leaderboard/top`, { params: { limit } });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("fetchLeaderboard failed", e);
    return [];
  }
};

const NAME_KEY = "archery_player_name";

export const getPlayerName = () => localStorage.getItem(NAME_KEY) || "";
export const setPlayerName = (name) => {
  const trimmed = (name || "").trim().slice(0, 16);
  if (trimmed.length >= 2) localStorage.setItem(NAME_KEY, trimmed);
  return trimmed;
};
