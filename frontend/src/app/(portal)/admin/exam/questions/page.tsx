"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, X, Save } from "lucide-react";
import { AdminQuestion, AdminOption } from "@/types";

export default function AdminExamQuestionsPage() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [questionText, setQuestionText] = useState("");
  const [type, setType] = useState("MULTIPLE_CHOICE");
  const [order, setOrder] = useState(1);
  const [options, setOptions] = useState([
    { optionText: "", isCorrect: true },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ]);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/exam-engine/admin/questions",
        {
          withCredentials: true,
        },
      );
      setQuestions(res.data);
    } catch (error) {
      console.error("Failed to fetch questions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initFetch = async () => {
      await fetchQuestions();
    };
    initFetch();
  }, []);

  const openNewModal = () => {
    setEditingId(null);
    setQuestionText("");
    setType("MULTIPLE_CHOICE");
    setOrder(questions.length + 1);
    setOptions([
      { optionText: "", isCorrect: true },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (q: AdminQuestion) => {
    setEditingId(q.id);
    setQuestionText(q.questionText);
    setType(q.type);
    setOrder(q.order);
    if (q.type === "MULTIPLE_CHOICE" && q.options && q.options.length > 0) {
      const existingOptions = q.options.map((o: AdminOption) => ({
        optionText: o.optionText,
        isCorrect: o.isCorrect,
      }));
      while (existingOptions.length < 4) {
        existingOptions.push({ optionText: "", isCorrect: false });
      }
      setOptions(existingOptions);
    } else {
      setOptions([
        { optionText: "", isCorrect: true },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
      ]);
    }
    setIsModalOpen(true);
  };

  const setCorrectOption = (index: number) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index,
    }));
    setOptions(newOptions);
  };

  const updateOptionText = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].optionText = text;
    setOptions(newOptions);
  };

  const handleSave = async () => {
    try {
      const payload = {
        questionText,
        type,
        order,
        options: type === "MULTIPLE_CHOICE" ? options : undefined,
      };

      if (editingId) {
        await axios.put(
          `http://localhost:5000/api/exam-engine/admin/questions/${editingId}`,
          payload,
          {
            withCredentials: true,
          },
        );
      } else {
        await axios.post(
          "http://localhost:5000/api/exam-engine/admin/questions",
          payload,
          {
            withCredentials: true,
          },
        );
      }

      setIsModalOpen(false);
      fetchQuestions();
    } catch (error) {
      console.error("Failed to save question", error);
      alert("Failed to save question. Please check the console.");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this question? This may affect existing exam records!",
      )
    )
      return;
    try {
      await axios.delete(
        `http://localhost:5000/api/exam-engine/admin/questions/${id}`,
        {
          withCredentials: true,
        },
      );
      fetchQuestions();
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-(--earist-primary)">
            Exam Question Bank
          </h1>
          <p className="text-sm text-(--earist-body-text)">
            Manage the multiple-choice and essay questions for the entrance
            exam.
          </p>
        </div>
        <Button
          onClick={openNewModal}
          className="bg-(--earist-secondary) hover:bg-orange-600"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Question
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-(--earist-body-text)">
              Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-(--earist-body-text)">
              No questions found. Add one to get started!
            </div>
          ) : (
            <div className="divide-y divide-(--earist-border-gray)">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="p-4 hover:bg-(--earist-surface-gray) transition-colors flex items-start justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs bg-white">
                        #{q.order}
                      </Badge>
                      <Badge
                        className={
                          q.type === "ESSAY"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }
                      >
                        {q.type === "ESSAY" ? "Essay" : "Multiple Choice"}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm text-(--earist-primary) mb-2">
                      {q.questionText}
                    </p>

                    {q.type === "MULTIPLE_CHOICE" && q.options && (
                      <div className="pl-4 space-y-1 mt-2">
                        {q.options.map((opt: AdminOption) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${opt.isCorrect ? "bg-green-500" : "bg-gray-300"}`}
                            ></span>
                            <span
                              className={
                                opt.isCorrect
                                  ? "font-semibold text-green-700"
                                  : "text-gray-500"
                              }
                            >
                              {opt.optionText}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(q)}
                      className="h-8 w-8 p-0 text-blue-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(q.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QUESTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <CardHeader className="sticky top-0 bg-white z-10 border-b border-(--earist-border-gray) pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-(--earist-primary)">
                {editingId ? "Edit Question" : "Add New Question"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-full m-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-(--earist-primary)">
                    Question Type
                  </label>
                  <select
                    className="w-full rounded-md border border-(--earist-border-gray) p-2 text-sm"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    <option value="ESSAY">Essay</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-(--earist-primary)">
                    Display Order
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-(--earist-border-gray) p-2 text-sm"
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-(--earist-primary)">
                  Question Text
                </label>
                <textarea
                  className="min-h-25 w-full rounded-md border border-(--earist-border-gray) p-2 text-sm focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) outline-none"
                  placeholder="Enter your question here..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                />
              </div>

              {type === "MULTIPLE_CHOICE" && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-(--earist-primary)">
                      Answer Options
                    </label>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-800 border-amber-200"
                    >
                      Select the radio button next to the correct answer
                    </Badge>
                  </div>

                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={opt.isCorrect}
                        onChange={() => setCorrectOption(i)}
                        className="h-4 w-4 cursor-pointer text-(--earist-primary) focus:ring-(--earist-primary)"
                      />
                      <input
                        type="text"
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        className={`flex-1 rounded-md border p-2 text-sm outline-none transition-colors ${
                          opt.isCorrect
                            ? "border-green-500 bg-green-50 focus:ring-1 focus:ring-green-500"
                            : "border-(--earist-border-gray) focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary)"
                        }`}
                        value={opt.optionText}
                        onChange={(e) => updateOptionText(i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-(--earist-primary) hover:bg-red-900"
                >
                  <Save className="mr-2 h-4 w-4" /> Save Question
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
