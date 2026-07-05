# Mr. T's AP Computer Science Portal - Phase 1 Guide

## Decisions Recorded

- Hosting: Netlify.
- Cloud storage and synchronization: Supabase.
- Option A confirmed: keep Supabase as the storage plan and do not add Firebase.
- Portal name: Mr. T's AP Computer Science Portal.
- Access: students and teachers must log in before viewing materials.
- Student password: MrTStds.
- Teacher password: MrTAdmin.
- Teacher editing: Draft and Publish workflow.
- Visual style: dark blue, white, and gold.
- Phase 1 course: AP Cybersecurity fully developed first.
- AP Cybersecurity course map: official five-unit College Board structure.
- AP Cybersecurity lesson count: 30 core lessons.
- AP Computer Science Principles is now populated with all five official big ideas and 27 core lessons.
- AP Computer Science A is now populated with the latest four-unit College Board structure and 26 core Java lessons.
- AP CSA uses CSAwesome2 AP CSA Java 2025+ as the requested reliable support source, with Oracle Java documentation for API details.

## Deployment Guide

1. Push the project to GitHub.
2. Create a Netlify site from the GitHub repository.
3. Add these Netlify environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
4. In Supabase, create a table named `portal_content` with these columns:
   - `id` as text primary key
   - `payload` as jsonb
   - `updated_at` as timestamptz
5. In Supabase Storage, create a public bucket named `portal-assets` for teacher-uploaded images and PDFs.
6. Deploy on Netlify.

## AP Cybersecurity Source Policy

- AP Cybersecurity notes are original summaries, not copied text from the CED or other copyrighted resources.
- College Board AP Cybersecurity pages are the primary curriculum source.
- NIST, CISA, OWASP, and NIST NICE are used only as supporting authoritative references for definitions, security controls, risk management, secure software, workforce context, and public safety guidance.
- Each AP Cybersecurity lesson includes references so students can verify the source basis.
- The Firebase configuration shared by the CEO is not used in this Option A build.

## AP CSP Source Policy

- AP Computer Science Principles notes are original summaries aligned to College Board AP CSP course and exam information.
- The five official big ideas are used: Creative Development, Data, Algorithms and Programming, Computer Systems and Networks, and Impact of Computing.
- Python documentation is used only as a reliable support reference where classroom code examples are helpful.
- Create performance task guidance is summarized from AP Central exam information and written in original language.

## AP CSA Source Policy

- AP Computer Science A notes are original summaries aligned to the current College Board four-unit AP CSA framework.
- The old ten-unit structure is not used.
- CSAwesome2 AP CSA Java 2025+ is used as the requested reliable curriculum support.
- Oracle Java documentation is used for Java API details such as String, Scanner, and ArrayList.

## AP Cybersecurity Phase 1 Coverage

- Unit 1: Introduction to Security includes assets, CIA triad, threats and vulnerabilities, social engineering, passwords and MFA, and responsible practice with AI.
- Unit 2: Securing Spaces includes physical access, inventory, defense in depth, environmental controls, policies and reporting, and evidence documentation.
- Unit 3: Securing Networks includes network foundations, IP addresses and ports, firewalls and ACLs, segmentation, wireless security, and network logs.
- Unit 4: Securing Devices includes endpoint hardening, malware, patch management, authentication and permissions, backups, and device indicators of compromise.
- Unit 5: Securing Applications and Data includes data protection, cryptography, web vulnerabilities, secure software practices, cloud security, and AP-style scenario practice.

## Teacher Manual

- Log in with the teacher password.
- Open a course, unit, and lesson.
- Select Teacher Tools.
- Edit lesson notes using the rich text editor.
- Use Save Draft when the lesson is not ready for students.
- Use Publish Draft when students should see the update.
- Use Add Lesson to create new lessons inside the selected unit.
- Use Delete Lesson carefully and export a backup before major changes.
- Use Backup / Export before major curriculum edits.
- Use Import Notes to restore from a saved JSON backup.
- Use Restore Official Phase 1 Content to return to the built-in AP Cybersecurity content.

## Student Manual

- Log in with the student password.
- Browse by course, unit, and lesson.
- Use the search bar to find topics, vocabulary, examples, and references.
- Mark lessons complete to track progress.
- Bookmark important lessons for quick review.
- Use Recently Viewed to return to previous lessons.
- Use Print Notes for paper copies.
- Use Download PDF to generate a lesson PDF.

## Maintenance Guide

- Review College Board AP Central before each school year.
- Keep AP Cybersecurity aligned to the latest official framework.
- Keep AP CSA aligned to the 2025 four-unit structure unless College Board updates it.
- Keep AP CSP aligned to the current CED and AP Classroom guidance.
- Export a backup after every major update.
- Review uploaded files for accessibility and copyright compliance.
- Rotate Supabase keys if they are ever exposed.
- Move to individual student accounts in a future phase if storing sensitive student-specific data.

## Phase Notes

- AP Cybersecurity is populated with 30 core lessons.
- AP Computer Science Principles is populated with 27 core lessons.
- AP Computer Science A is populated with 26 core lessons.
- Future work can now focus on quizzes, FRQ banks, coding exercises, flashcards, and analytics.