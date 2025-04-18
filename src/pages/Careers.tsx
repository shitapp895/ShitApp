import React from 'react'

const Careers = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Careers at ShitApp</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Summer Internship Opportunity</h2>
        
        <div className="mb-6">
          <p className="mb-4">
            Join our dynamic team at ShitApp for a unique summer internship experience where you'll 
            contribute to the development of our innovative social platform. This is an excellent opportunity
            for students passionate about web development, mobile applications, and creating engaging user experiences.
          </p>
          
          <p className="mb-4">
            Our internship program offers hands-on experience with modern technologies like React, Firebase, 
            and real-time applications. You'll work alongside our talented developers to implement new features,
            improve existing functionality, and help shape the future of ShitApp.
          </p>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">What You'll Do:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Develop and implement new features for our web application</li>
            <li>Collaborate with the team on UI/UX improvements</li>
            <li>Work with Firebase and real-time database technologies</li>
            <li>Participate in code reviews and agile development processes</li>
            <li>Learn and grow with mentorship from experienced developers</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Requirements:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Currently pursuing a degree in Computer Science, Software Engineering, or a related field</li>
            <li>Familiarity with JavaScript, TypeScript, and React</li>
            <li>Basic understanding of databases and API integration</li>
            <li>Strong problem-solving skills and attention to detail</li>
            <li>Excellent communication and teamwork abilities</li>
          </ul>
        </div>
        
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="text-xl font-medium mb-2">How to Apply:</h3>
          <p className="mb-2">
            Send your resume and a brief cover letter explaining why you're interested in joining ShitApp to:
          </p>
          <a 
            href="mailto:shitapp895@gmail.com" 
            className="text-primary font-medium hover:underline"
          >
            shitapp895@gmail.com
          </a>
          <p className="mt-2 text-sm">Please include "Summer Internship Application" in the subject line.</p>
        </div>
      </div>
    </div>
  )
}

export default Careers 