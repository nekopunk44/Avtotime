import { useState, useCallback } from "react";
import axios from "axios";
import { serverURL } from "../config/serverUrl";

const API_BASE = `${serverURL}/api/driving-courses`;

export const useDrivingCourses = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [statistics, setStatistics] = useState(null);

  // Получить рисунки вопросов для конкретного билета
  const getExamQuestions = useCallback(async (ticketNumber = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/exam`, {
        params: { ticket: ticketNumber },
        withCredentials: true,
      });
      setQuestions(response.data.questions || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      console.error("Error fetching exam questions:", errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Получить вопросы для практики
  const getPracticeQuestions = useCallback(async (ticketNumber = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = ticketNumber ? { ticket: ticketNumber } : {};
      const response = await axios.get(`${API_BASE}/practice`, {
        params,
        withCredentials: true,
      });
      setQuestions(response.data.questions || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      console.error("Error fetching practice questions:", errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Получить вопросы для марафона
  const getMarathonQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/marathon`, {
        withCredentials: true,
      });
      setQuestions(response.data.questions || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      console.error("Error fetching marathon questions:", errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Сохранить результон теста
  const submitTestResult = useCallback(async (testData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/result`, testData, {
        withCredentials: true,
      });
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      console.error("Error submitting test result:", errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Получить результаты пользователя
  const getUserResults = useCallback(async (mode = null, limit = 10) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (mode) params.mode = mode;
      params.limit = limit;

      const response = await axios.get(`${API_BASE}/results`, {
        params,
        withCredentials: true,
      });
      setResults(response.data.results || []);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      console.error("Error fetching user results:", errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Получить статистику пользователя
  const getUserStatistics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/statistics`, {
        withCredentials: true,
      });
      setStatistics(response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      console.error("Error fetching statistics:", errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    questions,
    loading,
    error,
    results,
    statistics,

    // Methods
    getExamQuestions,
    getPracticeQuestions,
    getMarathonQuestions,
    submitTestResult,
    getUserResults,
    getUserStatistics,

    // Helpers
    setQuestions,
    setError,
  };
};
