"use client";

import React, { useEffect, useState, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const firebaseConfig = {
  apiKey: "AIzaSyAssA5CA6slL3afb5Fny5t2lG3u2LgoF9o",
  authDomain: "yuktiherbs-84439.firebaseapp.com",
  projectId: "yuktiherbs-84439",
  storageBucket: "yuktiherbs-84439.appspot.com",
  messagingSenderId: "242581528273",
  appId: "1:242581528273:web:48dd0b105bfb0102b7aff0",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const defaultMedicines = [
  { id: "1", name: "Livocure Syrup", dose: "10 ml", time: "08:00", taken: false },
  { id: "2", name: "Immuno Tabs", dose: "1 Tablet", time: "13:00", taken: false },
  { id: "3", name: "Trikatu Churna", dose: "5 g", time: "21:00", taken: false },
];

export default function Page() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [medicines, setMedicines] = useState(defaultMedicines);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newTime, setNewTime] = useState("08:00");

  const timersRef = useRef({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setMedicines(defaultMedicines);
        clearAllTimers();
        return;
      }
      setUser(firebaseUser);
      const docRef = doc(db, "patients", firebaseUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setMedicines(snap.data().medicines);
      } else {
        await setDoc(docRef, { medicines: defaultMedicines });
        setMedicines(defaultMedicines);
      }
    });
    return () => unsub();
  }, []);

  function clearAllTimers() {
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};
  }

  useEffect(() => {
    if (!user || medicines.length === 0) return;

    clearAllTimers();

    medicines.forEach((med) => {
      scheduleReminder(med);
    });
  }, [medicines, user]);

  function scheduleReminder(med) {
    if (med.taken) return;

    const now = new Date();
    const [hours, minutes] = med.time.split(":").map(Number);

    let medTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );

    let reminderTime = new Date(medTime.getTime() - 5 * 60 * 1000);

    if (reminderTime <= now) {
      medTime = new Date(medTime.getTime() + 24 * 60 * 60 * 1000);
      reminderTime = new Date(medTime.getTime() - 5 * 60 * 1000);
    }

    const delay = reminderTime.getTime() - now.getTime();

    if (timersRef.current[med.id]) clearTimeout(timersRef.current[med.id]);

    timersRef.current[med.id] = setTimeout(() => {
      sendBrowserNotification(med);
    }, delay);
  }

  function sendBrowserNotification(med) {
    const title = "Medicine Reminder";
    const options = {
      body: `Take ${med.name} (${med.dose}) at ${med.time}`,
      icon: "/pill-icon.png",
    };

    if (!("Notification" in window)) {
      toast.info(`Reminder: Take ${med.name} (${med.dose}) at ${med.time}`);
      return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, options);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, options);
        } else {
          toast.info(`Reminder: Take ${med.name} (${med.dose}) at ${med.time}`);
        }
      });
    } else {
      toast.info(`Reminder: Take ${med.name} (${med.dose}) at ${med.time}`);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      toast.error("Email & password required");
      return;
    }
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "patients", cred.user.uid), { medicines: defaultMedicines });
      toast.success("Sign up successful!");
      setError("");
    } catch (err) {
      toast.error(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      toast.error("Email & password required");
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Logged in successfully!");
      setError("");
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    signOut(auth);
    clearAllTimers();
    toast.info("Logged out");
  }

  async function toggleTaken(id) {
    if (!user) return;
    const updated = medicines.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m));
    setMedicines(updated);
    await updateDoc(doc(db, "patients", user.uid), { medicines: updated });
  }

  async function addMedicine() {
    if (!newName || !newDose || !newTime) {
      toast.error("Name, dose & time required");
      return;
    }
    const newMed = {
      id: Date.now().toString(),
      name: newName,
      dose: newDose,
      time: newTime,
      taken: false,
    };
    const updated = [...medicines, newMed];
    setMedicines(updated);
    setNewName("");
    setNewDose("");
    setNewTime("08:00");
    setError("");
    if (user) await updateDoc(doc(db, "patients", user.uid), { medicines: updated });
    toast.success("Medicine added");
  }

  async function deleteMedicine(id) {
    if (!user) return;
    const updated = medicines.filter((m) => m.id !== id);
    setMedicines(updated);
    await updateDoc(doc(db, "patients", user.uid), { medicines: updated });
    toast.success("Medicine deleted");
  }

  async function sendReminderEmailForAll() {
    if (!user || !medicines || medicines.length === 0) {
      toast.error("No medicines to send reminders for.");
      return;
    }

    for (const med of medicines) {
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            medicineName: med.name,
            dose: med.dose,
            time: med.time,
          }),
        });

        const data = await response.json();
        console.log(`Email sent for ${med.name}:`, data);
      } catch (error) {
        console.error(`Failed to send email for ${med.name}:`, error);
      }
    }

    toast.success("Reminder emails sent successfully!");
  }

  return (
    <main className="max-w-md mx-auto p-4 font-sans bg-gray-900 min-h-screen text-gray-100">
      <ToastContainer position="top-right" autoClose={5000} />

      {/* Branding Header */}
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-2">YuktiTracker</h1>
        <p className="text-gray-400">
          Your trusted medicine tracker & reminder system for better health management.
        </p>
        <p className="mt-1 text-sm text-green-400 italic">
          Powered by Rahul Chauhan
        </p>
      </header>

      {!user ? (
        <>
          <div className="mb-4 space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <div className="flex justify-between">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-1/2 mr-2 py-3 rounded bg-purple-700 hover:bg-purple-600 transition text-white font-semibold"
              >
                Login
              </button>
              <button
                onClick={handleSignUp}
                disabled={loading}
                className="w-1/2 ml-2 py-3 rounded bg-green-600 hover:bg-green-500 transition text-white font-semibold"
              >
                Sign Up
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
        </>
      ) : (
        <>
          <div className="mb-6 flex justify-between items-center">
            <p className="font-semibold">Logged in as: {user.email}</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 transition text-white font-semibold"
            >
              Logout
            </button>
          </div>

          {/* Medicine List */}
          <section className="mb-6">
            <h2 className="text-2xl font-bold mb-3">Your Medicines</h2>
            {medicines.length === 0 && (
              <p className="text-gray-400">No medicines added yet.</p>
            )}
            <ul className="space-y-4">
              {medicines.map((med) => (
                <li
                  key={med.id}
                  className="flex justify-between items-center p-3 rounded bg-gray-800 border border-gray-700"
                >
                  <div>
                    <p className="text-lg font-semibold">{med.name}</p>
                    <p className="text-sm text-gray-400">{med.dose}</p>
                    <p className="text-sm text-gray-400">{med.time}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleTaken(med.id)}
                      className={`px-3 py-1 rounded font-semibold ${
                        med.taken
                          ? "bg-green-600 hover:bg-green-500"
                          : "bg-yellow-600 hover:bg-yellow-500"
                      } transition text-white`}
                    >
                      {med.taken ? "Taken" : "Mark Taken"}
                    </button>
                    <button
                      onClick={() => deleteMedicine(med.id)}
                      className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 transition text-white font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Add New Medicine */}
          <section className="mb-6">
            <h2 className="text-2xl font-bold mb-3">Add New Medicine</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Medicine Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-3 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <input
                type="text"
                placeholder="Dose (e.g., 10 ml, 1 tablet)"
                value={newDose}
                onChange={(e) => setNewDose(e.target.value)}
                className="w-full p-3 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full p-3 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <button
                onClick={addMedicine}
                className="w-full py-3 rounded bg-blue-700 hover:bg-blue-600 transition text-white font-semibold"
              >
                Add Medicine
              </button>
            </div>
          </section>

          {/* Send Email Reminders Button */}
          <section>
            <button
              onClick={sendReminderEmailForAll}
              className="w-full py-3 rounded bg-indigo-600 hover:bg-indigo-500 transition text-white font-semibold"
            >
              Send Reminder Emails for All
            </button>
          </section>
        </>
      )}
    </main>
  );
}
