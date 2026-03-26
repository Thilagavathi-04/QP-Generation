import React, { useState, useEffect } from 'react';
import { UserPlus, User, BookOpen, Trash } from 'lucide-react';
import { db, secondaryAuth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { showToast } from '../components/Toast';

export default function AdminProfile() {
  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyDept, setFacultyDept] = useState('');
  const [password, setPassword] = useState('');
  
  const [courses, setCourses] = useState([]);
  const [currentRegulation, setCurrentRegulation] = useState('');
  const [currentSubject, setCurrentSubject] = useState('');
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersCol = collection(db, 'users');
      const snapshot = await getDocs(usersCol);
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (err) {
      console.error(err);
      showToast('Error loading users', 'error');
    }
  };

  const handleAddCourse = (e) => {
    e.preventDefault();
    if (currentRegulation && currentSubject) {
      setCourses([...courses, { regulation: currentRegulation, subject: currentSubject }]);
      setCurrentRegulation('');
      setCurrentSubject('');
    }
  };

  const handleRemoveCourse = (index) => {
    setCourses(courses.filter((_, i) => i !== index));
  };

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create User in Firebase Auth using the Secondary App
      // Hardcoded default password as requested by user
      const defaultPassword = "12345678";
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, facultyEmail, defaultPassword);
      const uid = userCredential.user.uid;

      // 2. Add profile document in Firestore `users` collection matching their database picture
      await setDoc(doc(db, "users", uid), {
        Name: facultyName,
        email: facultyEmail,
        Dept: facultyDept,
        role: "user", // "user" for faculty
        courses: courses,
        mustChangePassword: true, // Flag for first login
        createdAt: new Date()
      });

      showToast(`Faculty ${facultyName} added successfully! Default password: ${defaultPassword}`, 'success');
      
      // Clear form
      setFacultyName('');
      setFacultyEmail('');
      setFacultyDept('');
      setCourses([]);
      
      fetchUsers();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Error creating faculty account', 'error');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{
        background: 'var(--primary-700)',
        padding: '2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        color: 'white'
      }}>
        <h1 style={{ color: 'white', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Manage Faculty Profiles</h1>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Add and manage user access & course assignments</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* ADD FACULTY CARD */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary-700)' }}>
            <UserPlus size={20} /> Add New Faculty User
          </h3>
          <form onSubmit={handleAddFaculty}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Full Name</label>
              <input type="text" required className="form-input" value={facultyName} onChange={(e) => setFacultyName(e.target.value)} placeholder="e.g. John Doe"/>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Email Address (Login ID)</label>
              <input type="email" required className="form-input" value={facultyEmail} onChange={(e) => setFacultyEmail(e.target.value)} placeholder="e.g. jdoe@university.edu"/>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Department</label>
              <input type="text" required className="form-input" value={facultyDept} onChange={(e) => setFacultyDept(e.target.value)} placeholder="e.g. AIML"/>
            </div>
            
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: 'var(--primary-50)', 
              borderRadius: '8px',
              border: '1px solid var(--primary-200)',
              fontSize: '0.875rem',
              color: 'var(--primary-800)'
            }}>
              <strong>Note:</strong> Default password will be <code>12345678</code>. Users can change it on their first login.
            </div>

            <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--secondary-200)' }}/>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-700)', marginBottom: '1rem' }}>
                <BookOpen size={18} /> Assigned Courses
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Regulation</label>
                  <input type="text" className="form-input" value={currentRegulation} onChange={(e) => setCurrentRegulation(e.target.value)} placeholder="e.g. 2021"/>
                </div>
                <div className="form-group" style={{ flex: 2, margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Subject Code/Name</label>
                  <input type="text" className="form-input" value={currentSubject} onChange={(e) => setCurrentSubject(e.target.value)} placeholder="e.g. DL"/>
                </div>
                <button type="button" onClick={handleAddCourse} disabled={!currentRegulation || !currentSubject} className="btn btn-secondary" style={{ padding: '0.625rem 1rem' }}>Add</button>
              </div>
              
              {courses.length > 0 && (
                <div style={{ padding: '1rem', background: 'var(--primary-50)', borderRadius: '8px', border: '1px solid var(--primary-200)' }}>
                  {courses.map((course, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: idx !== courses.length - 1 ? '1px solid var(--primary-200)' : 'none' }}>
                      <span><strong>{course.regulation}</strong> - {course.subject}</span>
                      <Trash size={16} color="var(--danger-500)" style={{ cursor: 'pointer' }} onClick={() => handleRemoveCourse(idx)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Adding Faculty...' : 'Create Faculty Profile'}
            </button>
          </form>
        </div>

        {/* FACULTY LIST CARD */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary-700)' }}>
            <User size={20} /> Registered Faculty
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.length === 0 ? (
              <p style={{ color: 'var(--secondary-500)', fontStyle: 'italic' }}>No faculty profiles found.</p>
            ) : (
              users.map(user => (
                <div key={user.id} style={{ padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid var(--secondary-200)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--primary-800)' }}>{user.Name || 'Unknown'}</strong>
                      {user.role === 'admin' && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '2px 6px', background: 'var(--danger-100)', color: 'var(--danger-700)', borderRadius: '4px' }}>ADMIN</span>}
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary-600)', background: 'var(--primary-100)', padding: '2px 8px', borderRadius: '12px' }}>{user.Dept || 'N/A'}</span>
                  </div>
                  <div style={{ color: 'var(--secondary-500)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{user.email}</div>
                  
                  {user.courses && user.courses.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {user.courses.map((course, i) => (
                        <span key={i} style={{ fontSize: '0.75rem', padding: '3px 8px', background: 'var(--success-100)', color: 'var(--success-700)', border: '1px solid var(--success-500)', borderRadius: '4px' }}>
                          {course.regulation} - {course.subject}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
