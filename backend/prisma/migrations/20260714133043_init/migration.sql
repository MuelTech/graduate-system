-- CreateTable
CREATE TABLE `users` (
    `user_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'STUDENT', 'PANELIST', 'CUSTOM', 'APPLICANT') NOT NULL DEFAULT 'APPLICANT',
    `custom_role_id` VARCHAR(191) NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_custom_role_id_fkey`(`custom_role_id`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `student_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `student_number` VARCHAR(191) NULL,
    `cellphone` VARCHAR(191) NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `admission_status` ENUM('APPLICANT', 'ENROLLED', 'GRADUATED', 'DISMISSED') NOT NULL DEFAULT 'APPLICANT',
    `enrollment_date` DATE NULL,
    `residency_start_date` DATE NULL,
    `curriculum_type` ENUM('OLD', 'NEW') NULL,
    `pinnacle_applicant_id` VARCHAR(191) NULL,
    `undergraduate_program_id` VARCHAR(191) NULL,
    `date_of_birth` DATE NULL,
    `is_program_aligned` BOOLEAN NULL,
    `alignment_status` ENUM('ALIGNED', 'PENDING_WAIVER', 'CLEARED') NULL,
    `previous_masters_program_id` VARCHAR(191) NULL,
    `cor_extracted_year_level` VARCHAR(191) NULL,
    `cor_extracted_scholarship` VARCHAR(191) NULL,
    `last_cor_sync_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `students_user_id_key`(`user_id`),
    UNIQUE INDEX `students_student_number_key`(`student_number`),
    INDEX `students_previous_masters_program_id_fkey`(`previous_masters_program_id`),
    INDEX `students_program_id_fkey`(`program_id`),
    INDEX `students_undergraduate_program_id_fkey`(`undergraduate_program_id`),
    PRIMARY KEY (`student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `panelists` (
    `panelist_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `highest_educational_attainment` VARCHAR(191) NULL,
    `office_affiliation` VARCHAR(191) NULL,
    `specialization` VARCHAR(191) NULL,
    `is_external` BOOLEAN NOT NULL DEFAULT false,
    `is_available_as_adviser` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `panelists_user_id_key`(`user_id`),
    PRIMARY KEY (`panelist_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `programs` (
    `program_id` VARCHAR(191) NOT NULL,
    `program_name` VARCHAR(191) NOT NULL,
    `program_type` ENUM('MASTERS', 'DOCTORAL') NOT NULL,
    `department` VARCHAR(191) NULL,
    `max_residency_years` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`program_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `undergraduate_programs` (
    `ug_program_id` VARCHAR(191) NOT NULL,
    `program_name` VARCHAR(191) NOT NULL,
    `acronym` VARCHAR(191) NULL,
    `college` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `undergraduate_programs_program_name_key`(`program_name`),
    PRIMARY KEY (`ug_program_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_roles` (
    `role_id` VARCHAR(191) NOT NULL,
    `role_name` VARCHAR(191) NOT NULL,
    `role_description` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `custom_roles_role_name_key`(`role_name`),
    INDEX `custom_roles_created_by_fkey`(`created_by`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_feature_access` (
    `access_id` VARCHAR(191) NOT NULL,
    `role_id` VARCHAR(191) NOT NULL,
    `feature_key` VARCHAR(191) NOT NULL,
    `feature_label` VARCHAR(191) NULL,
    `can_view` BOOLEAN NOT NULL DEFAULT false,
    `can_edit` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_feature_access_role_id_fkey`(`role_id`),
    PRIMARY KEY (`access_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `residency_tracking` (
    `residency_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `max_years` INTEGER NOT NULL,
    `warning_sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `residency_tracking_student_id_key`(`student_id`),
    PRIMARY KEY (`residency_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curriculum_waivers` (
    `waiver_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `waiver_date` DATE NOT NULL,
    `recommended_by` VARCHAR(191) NOT NULL,
    `approved_by` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `curriculum_waivers_approved_by_fkey`(`approved_by`),
    INDEX `curriculum_waivers_recommended_by_fkey`(`recommended_by`),
    INDEX `curriculum_waivers_student_id_fkey`(`student_id`),
    PRIMARY KEY (`waiver_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_slots` (
    `slot_id` VARCHAR(191) NOT NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `exam_date` DATE NOT NULL,
    `exam_time` TIME(0) NOT NULL,
    `max_slots` INTEGER NOT NULL,
    `slots_taken` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exam_slots_program_id_fkey`(`program_id`),
    PRIMARY KEY (`slot_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicant_bridging_waivers` (
    `waiver_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `undergraduate_program_id` VARCHAR(191) NULL,
    `intended_program_id` VARCHAR(191) NOT NULL,
    `waiver_form_downloaded_at` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'VALIDATED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `validated_by` VARCHAR(191) NULL,
    `validated_at` DATETIME(3) NULL,
    `admin_notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `applicant_bridging_waivers_student_id_key`(`student_id`),
    INDEX `applicant_bridging_waivers_intended_program_id_fkey`(`intended_program_id`),
    INDEX `applicant_bridging_waivers_undergraduate_program_id_fkey`(`undergraduate_program_id`),
    INDEX `applicant_bridging_waivers_validated_by_fkey`(`validated_by`),
    PRIMARY KEY (`waiver_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entrance_exam_applications` (
    `application_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `slot_id` VARCHAR(191) NOT NULL,
    `strike_count` INTEGER NOT NULL DEFAULT 0,
    `application_date` DATE NOT NULL,
    `exam_date` DATE NULL,
    `exam_time` TIME(0) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'TAKEN', 'PASSED', 'FAILED', 'DISQUALIFIED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `entrance_exam_applications_program_id_fkey`(`program_id`),
    INDEX `entrance_exam_applications_slot_id_fkey`(`slot_id`),
    INDEX `entrance_exam_applications_student_id_fkey`(`student_id`),
    PRIMARY KEY (`application_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entrance_exam_scores` (
    `score_id` VARCHAR(191) NOT NULL,
    `application_id` VARCHAR(191) NOT NULL,
    `graded_by` VARCHAR(191) NOT NULL,
    `multiple_choice_score` DECIMAL(65, 30) NULL,
    `essay_score` DECIMAL(65, 30) NULL,
    `total_score` DECIMAL(65, 30) NULL,
    `status` ENUM('PASSED', 'FAILED') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `entrance_exam_scores_application_id_key`(`application_id`),
    INDEX `entrance_exam_scores_graded_by_fkey`(`graded_by`),
    PRIMARY KEY (`score_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comp_exam_records` (
    `comp_exam_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comp_exam_records_student_id_fkey`(`student_id`),
    PRIMARY KEY (`comp_exam_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('RESIDENCY_WARNING', 'DEFENSE_SCHEDULE', 'MEMO', 'REQUIREMENT_STATUS', 'CERT_READY', 'EXAM_RESULT', 'CREDENTIAL_DISPATCH', 'ESIGN_REQUEST', 'ADVISER_ASSIGNMENT', 'PLAGIARISM_RESULT', 'DEFENSE_ASSIGNMENT') NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `related_record_type` VARCHAR(191) NULL,
    `related_record_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_fkey`(`user_id`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cor_uploads` (
    `cor_upload_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `original_filename` VARCHAR(191) NULL,
    `ocr_status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `ocr_error_message` VARCHAR(191) NULL,
    `uploaded_at` DATETIME(3) NOT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cor_uploads_student_id_fkey`(`student_id`),
    PRIMARY KEY (`cor_upload_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cor_records` (
    `cor_record_id` VARCHAR(191) NOT NULL,
    `cor_upload_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `registration_number` VARCHAR(191) NULL,
    `academic_year` VARCHAR(191) NULL,
    `semester` ENUM('1st', '2nd', 'summer') NULL,
    `college` VARCHAR(191) NULL,
    `extracted_program_name` VARCHAR(191) NULL,
    `extracted_curriculum_year` VARCHAR(191) NULL,
    `extracted_year_level` VARCHAR(191) NULL,
    `extracted_scholarship_discount` VARCHAR(191) NULL,
    `total_assessment` DECIMAL(65, 30) NULL,
    `less_financial_aid` DECIMAL(65, 30) NULL,
    `net_assessed` DECIMAL(65, 30) NULL,
    `credit_memo` DECIMAL(65, 30) NULL,
    `total_discount` DECIMAL(65, 30) NULL,
    `total_payment` DECIMAL(65, 30) NULL,
    `outstanding_balance` DECIMAL(65, 30) NULL,
    `payment_1st_due` DECIMAL(65, 30) NULL,
    `payment_2nd_due` DECIMAL(65, 30) NULL,
    `payment_3rd_due` DECIMAL(65, 30) NULL,
    `payment_validation_date` DATE NULL,
    `official_receipt_number` VARCHAR(191) NULL,
    `approved_by_registrar` VARCHAR(191) NULL,
    `is_admin_verified` BOOLEAN NOT NULL DEFAULT false,
    `verification_method` ENUM('qr_auto', 'ocr_auto', 'admin_manual') NULL,
    `verified_by` VARCHAR(191) NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cor_records_cor_upload_id_key`(`cor_upload_id`),
    INDEX `cor_records_student_id_fkey`(`student_id`),
    INDEX `cor_records_verified_by_fkey`(`verified_by`),
    PRIMARY KEY (`cor_record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requirements_checklist` (
    `requirement_id` VARCHAR(191) NOT NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `stage` ENUM('ADMISSION', 'TITLE_DEFENSE', 'PROPOSAL_DEFENSE', 'FINAL_DEFENSE', 'GRADUATION') NOT NULL,
    `requirement_name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_mandatory` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `requirements_checklist_program_id_fkey`(`program_id`),
    PRIMARY KEY (`requirement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_requirements` (
    `student_req_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `requirement_id` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NULL,
    `submission_date` DATE NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by` VARCHAR(191) NOT NULL,
    `review_notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_requirements_requirement_id_fkey`(`requirement_id`),
    INDEX `student_requirements_reviewed_by_fkey`(`reviewed_by`),
    INDEX `student_requirements_student_id_fkey`(`student_id`),
    PRIMARY KEY (`student_req_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adviser_requests` (
    `adviser_req_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `requested_adviser_id` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approved_by` VARCHAR(191) NOT NULL,
    `request_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `adviser_requests_approved_by_fkey`(`approved_by`),
    INDEX `adviser_requests_requested_adviser_id_fkey`(`requested_adviser_id`),
    INDEX `adviser_requests_student_id_fkey`(`student_id`),
    PRIMARY KEY (`adviser_req_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adviser_assignments` (
    `assignment_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `adviser_id` VARCHAR(191) NOT NULL,
    `assigned_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `adviser_assignments_adviser_id_fkey`(`adviser_id`),
    INDEX `adviser_assignments_student_id_fkey`(`student_id`),
    PRIMARY KEY (`assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thesis_records` (
    `thesis_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NOT NULL,
    `stage` ENUM('TITLE', 'PROPOSAL', 'FINAL') NOT NULL DEFAULT 'TITLE',
    `status` ENUM('PENDING', 'APPROVED', 'SCHEDULED', 'PASSED', 'FAILED', 'REVISION') NOT NULL DEFAULT 'PENDING',
    `or_number` VARCHAR(191) NULL,
    `amount_paid` DECIMAL(65, 30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thesis_records_assignment_id_fkey`(`assignment_id`),
    INDEX `thesis_records_student_id_fkey`(`student_id`),
    PRIMARY KEY (`thesis_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thesis_titles` (
    `title_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `title_text` TEXT NOT NULL,
    `is_selected` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thesis_titles_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`title_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thesis_documents` (
    `document_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `doc_type` ENUM('PROPOSAL_CHAPTERS', 'FINAL_MANUSCRIPT', 'PLAGIARISM_REPORT', 'RESPONDENT_DATA', 'INSTRUMENTS', 'COR', 'RECEIPT') NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `copy_number` INTEGER NULL,
    `uploaded_at` DATETIME(3) NOT NULL,

    INDEX `thesis_documents_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `defense_schedules` (
    `schedule_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `defense_date` DATE NOT NULL,
    `defense_time` TIME(0) NOT NULL,
    `venue_or_link` VARCHAR(191) NULL,
    `defense_type` ENUM('TITLE_DEFENSE', 'PROPOSAL_DEFENSE', 'FINAL_DEFENSE') NOT NULL,
    `set_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `defense_schedules_set_by_fkey`(`set_by`),
    INDEX `defense_schedules_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`schedule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `panel_assignments` (
    `panel_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `role` ENUM('CHAIRMAN', 'PANELIST', 'ADVISER', 'RAPPORTEUR', 'FACILITATOR') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `panel_assignments_schedule_id_fkey`(`schedule_id`),
    INDEX `panel_assignments_user_id_fkey`(`user_id`),
    PRIMARY KEY (`panel_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oral_exam_scores` (
    `score_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `panel_id` VARCHAR(191) NOT NULL,
    `timeliness_relevance` DECIMAL(65, 30) NULL,
    `organization` DECIMAL(65, 30) NULL,
    `depth_comprehensiveness` DECIMAL(65, 30) NULL,
    `relevance_conclusions` DECIMAL(65, 30) NULL,
    `evidence_original_thinking` DECIMAL(65, 30) NULL,
    `group_a_average` DECIMAL(65, 30) NULL,
    `presentation` DECIMAL(65, 30) NULL,
    `mastery_subject` DECIMAL(65, 30) NULL,
    `communication_skill` DECIMAL(65, 30) NULL,
    `attitude` DECIMAL(65, 30) NULL,
    `group_b_average` DECIMAL(65, 30) NULL,
    `overall_average` DECIMAL(65, 30) NULL,
    `rating` ENUM('E', 'HS', 'VS', 'S', 'BS', 'F') NULL,
    `recommendations` TEXT NULL,
    `scored_at` DATETIME(3) NOT NULL,

    INDEX `oral_exam_scores_panel_id_fkey`(`panel_id`),
    INDEX `oral_exam_scores_schedule_id_fkey`(`schedule_id`),
    PRIMARY KEY (`score_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oral_exam_summary` (
    `summary_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `overall_average` DECIMAL(65, 30) NOT NULL,
    `final_rating` ENUM('E', 'HS', 'VS', 'S', 'BS', 'F') NOT NULL,
    `final_remarks` TEXT NULL,
    `student_copy_generated` BOOLEAN NULL,
    `official_copy_generated` BOOLEAN NULL,
    `attested_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oral_exam_summary_schedule_id_key`(`schedule_id`),
    INDEX `oral_exam_summary_attested_by_fkey`(`attested_by`),
    PRIMARY KEY (`summary_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plagiarism_results` (
    `strike_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `similarity_percentage` DECIMAL(65, 30) NOT NULL,
    `is_eligible` BOOLEAN NOT NULL,
    `submission_deadline` DATE NULL,
    `submitted_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `plagiarism_results_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`strike_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manuscript_submissions` (
    `submission_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `submission_date` DATE NOT NULL,
    `initial_deadline` DATE NULL,
    `number_of_copies` INTEGER NOT NULL,
    `extension_granted` BOOLEAN NOT NULL DEFAULT false,
    `extension_deadline` DATE NULL,
    `extension_approved_by` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SUBMITTED', 'APPROVED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `manuscript_submissions_thesis_id_key`(`thesis_id`),
    INDEX `manuscript_submissions_extension_approved_by_fkey`(`extension_approved_by`),
    PRIMARY KEY (`submission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manuscript_distributions` (
    `distribution_id` VARCHAR(191) NOT NULL,
    `submission_id` VARCHAR(191) NOT NULL,
    `recipient` ENUM('PNU_LIBRARY', 'NATIONAL_LIBRARY', 'EARIST_REGISTRAR', 'EARIST_LIBRARY', 'DEAN_GS', 'ADVISER') NOT NULL,
    `date_received` DATE NULL,
    `recipient_name` VARCHAR(191) NULL,
    `contact_number` VARCHAR(191) NULL,
    `signature_path` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `manuscript_distributions_submission_id_fkey`(`submission_id`),
    PRIMARY KEY (`distribution_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `acknowledgement_receipts` (
    `receipt_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `defense_type` ENUM('TITLE_DEFENSE', 'PROPOSAL_DEFENSE', 'FINAL_DEFENSE') NOT NULL,
    `receipt_date` DATETIME(3) NOT NULL,

    INDEX `acknowledgement_receipts_schedule_id_fkey`(`schedule_id`),
    INDEX `acknowledgement_receipts_student_id_fkey`(`student_id`),
    PRIMARY KEY (`receipt_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `e_library` (
    `elibrary_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `abstract` TEXT NULL,
    `full_paper_path` VARCHAR(191) NULL,
    `respondent_data_path` VARCHAR(191) NULL,
    `keywords` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `published_at` DATE NULL,
    `approved_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `e_library_thesis_id_key`(`thesis_id`),
    INDEX `e_library_approved_by_fkey`(`approved_by`),
    PRIMARY KEY (`elibrary_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rap_reports` (
    `rap_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `defense_type` ENUM('TITLE_DEFENSE', 'PROPOSAL_DEFENSE', 'FINAL_DEFENSE') NOT NULL,
    `report_date` DATE NULL,
    `venue` VARCHAR(191) NULL,
    `decisions_and_recommendations` TEXT NULL,
    `selected_title` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'DISTRIBUTED', 'ALL_SIGNED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `file_path` VARCHAR(191) NULL,
    `generated_by` VARCHAR(191) NULL,
    `generated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rap_reports_generated_by_fkey`(`generated_by`),
    INDEX `rap_reports_schedule_id_fkey`(`schedule_id`),
    INDEX `rap_reports_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`rap_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rap_report_signatures` (
    `sig_id` VARCHAR(191) NOT NULL,
    `rap_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `is_signed` BOOLEAN NULL,
    `signature_data` VARCHAR(191) NULL,
    `signed_at` DATETIME(3) NULL,
    `notified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rap_report_signatures_rap_id_fkey`(`rap_id`),
    INDEX `rap_report_signatures_user_id_fkey`(`user_id`),
    PRIMARY KEY (`sig_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adviser_certifications` (
    `cert_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `adviser_id` VARCHAR(191) NOT NULL,
    `defense_stage` ENUM('TITLE_DEFENSE', 'PROPOSAL_DEFENSE', 'FINAL_DEFENSE') NOT NULL,
    `certified_at` DATE NULL,
    `file_path` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ISSUED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `adviser_certifications_adviser_id_fkey`(`adviser_id`),
    INDEX `adviser_certifications_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`cert_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `statistician_certifications` (
    `cert_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `statistician_name` VARCHAR(191) NULL,
    `specialization` VARCHAR(191) NULL,
    `office_affiliation` VARCHAR(191) NULL,
    `eval_date` DATE NULL,
    `file_path` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SUBMITTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `statistician_certifications_thesis_id_key`(`thesis_id`),
    PRIMARY KEY (`cert_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grammarian_certifications` (
    `cert_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `grammarian_name` VARCHAR(191) NULL,
    `specialization` VARCHAR(191) NULL,
    `office_affiliation` VARCHAR(191) NULL,
    `eval_date` DATE NULL,
    `file_path` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SUBMITTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `grammarian_certifications_thesis_id_key`(`thesis_id`),
    PRIMARY KEY (`cert_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `research_variable_forms` (
    `var_form_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `variable_content` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED_BY_PANEL') NOT NULL DEFAULT 'PENDING',
    `has_all_signatures` BOOLEAN NULL,
    `file_path` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `research_variable_forms_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`var_form_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `research_var_signatures` (
    `sig_id` VARCHAR(191) NOT NULL,
    `var_form_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `is_signed` BOOLEAN NULL,
    `signed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `research_var_signatures_user_id_fkey`(`user_id`),
    INDEX `research_var_signatures_var_form_id_fkey`(`var_form_id`),
    PRIMARY KEY (`sig_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expert_evaluation_requests` (
    `request_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `instrument_type` VARCHAR(191) NULL,
    `instrument_description` TEXT NULL,
    `status` ENUM('PENDING', 'ASSIGNED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `assigned_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expert_evaluation_requests_assigned_by_fkey`(`assigned_by`),
    INDEX `expert_evaluation_requests_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expert_evaluations` (
    `eval_id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `thesis_id` VARCHAR(191) NOT NULL,
    `evaluator_name` VARCHAR(191) NULL,
    `evaluator_affiliation` VARCHAR(191) NULL,
    `evaluator_specialization` VARCHAR(191) NULL,
    `comprehensiveness_score` INTEGER NULL,
    `clarity_language_score` INTEGER NULL,
    `usability_score` INTEGER NULL,
    `general_appearance_score` INTEGER NULL,
    `comments` VARCHAR(191) NULL,
    `eval_date` DATE NULL,
    `file_path` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `expert_evaluations_request_id_fkey`(`request_id`),
    INDEX `expert_evaluations_thesis_id_fkey`(`thesis_id`),
    PRIMARY KEY (`eval_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memos` (
    `memo_id` VARCHAR(191) NOT NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `target_audience` ENUM('ALL', 'STUDENTS', 'PANELISTS', 'PROGRAM') NOT NULL,
    `program_id` VARCHAR(191) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `memos_created_by_fkey`(`created_by`),
    INDEX `memos_program_id_fkey`(`program_id`),
    PRIMARY KEY (`memo_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_files` (
    `file_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_files_student_id_fkey`(`student_id`),
    PRIMARY KEY (`file_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chatbot_faqs` (
    `faq_id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `category` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chatbot_faqs_created_by_fkey`(`created_by`),
    PRIMARY KEY (`faq_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_calendars` (
    `calendar_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `event_title` VARCHAR(191) NOT NULL,
    `event_date` DATE NOT NULL,
    `event_description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_calendars_student_id_fkey`(`student_id`),
    PRIMARY KEY (`calendar_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_year_calendar` (
    `event_id` VARCHAR(191) NOT NULL,
    `academic_year` VARCHAR(191) NULL,
    `event_title` VARCHAR(191) NULL,
    `event_type` ENUM('DEFENSE_PERIOD', 'ENROLLMENT', 'HOLIDAY', 'EXAM_PERIOD', 'GRADUATION', 'OTHER') NOT NULL,
    `event_start` DATE NOT NULL,
    `event_end` DATE NOT NULL,
    `description` TEXT NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `school_year_calendar_created_by_fkey`(`created_by`),
    PRIMARY KEY (`event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `setting_id` VARCHAR(191) NOT NULL,
    `setting_key` VARCHAR(191) NOT NULL,
    `setting_value` TEXT NULL,
    `setting_type` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') NOT NULL,
    `label` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `is_editable_by_admin` BOOLEAN NOT NULL DEFAULT true,
    `last_modified_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_setting_key_key`(`setting_key`),
    INDEX `system_settings_last_modified_by_fkey`(`last_modified_by`),
    PRIMARY KEY (`setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `log_id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `action_type` VARCHAR(191) NOT NULL,
    `target_table` VARCHAR(191) NULL,
    `target_id` VARCHAR(191) NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `description` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_id_fkey`(`actor_id`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `template_id` VARCHAR(191) NOT NULL,
    `template_key` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body_html` TEXT NOT NULL,
    `variables_description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_templates_template_key_key`(`template_key`),
    INDEX `email_templates_created_by_fkey`(`created_by`),
    INDEX `email_templates_updated_by_fkey`(`updated_by`),
    PRIMARY KEY (`template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_custom_role_id_fkey` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`role_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_previous_masters_program_id_fkey` FOREIGN KEY (`previous_masters_program_id`) REFERENCES `programs`(`program_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs`(`program_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_undergraduate_program_id_fkey` FOREIGN KEY (`undergraduate_program_id`) REFERENCES `undergraduate_programs`(`ug_program_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panelists` ADD CONSTRAINT `panelists_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_feature_access` ADD CONSTRAINT `role_feature_access_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `custom_roles`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `residency_tracking` ADD CONSTRAINT `residency_tracking_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_waivers` ADD CONSTRAINT `curriculum_waivers_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_waivers` ADD CONSTRAINT `curriculum_waivers_recommended_by_fkey` FOREIGN KEY (`recommended_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_waivers` ADD CONSTRAINT `curriculum_waivers_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_slots` ADD CONSTRAINT `exam_slots_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs`(`program_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_bridging_waivers` ADD CONSTRAINT `applicant_bridging_waivers_intended_program_id_fkey` FOREIGN KEY (`intended_program_id`) REFERENCES `programs`(`program_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_bridging_waivers` ADD CONSTRAINT `applicant_bridging_waivers_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_bridging_waivers` ADD CONSTRAINT `applicant_bridging_waivers_undergraduate_program_id_fkey` FOREIGN KEY (`undergraduate_program_id`) REFERENCES `undergraduate_programs`(`ug_program_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_bridging_waivers` ADD CONSTRAINT `applicant_bridging_waivers_validated_by_fkey` FOREIGN KEY (`validated_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entrance_exam_applications` ADD CONSTRAINT `entrance_exam_applications_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs`(`program_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entrance_exam_applications` ADD CONSTRAINT `entrance_exam_applications_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `exam_slots`(`slot_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entrance_exam_applications` ADD CONSTRAINT `entrance_exam_applications_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entrance_exam_scores` ADD CONSTRAINT `entrance_exam_scores_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `entrance_exam_applications`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entrance_exam_scores` ADD CONSTRAINT `entrance_exam_scores_graded_by_fkey` FOREIGN KEY (`graded_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comp_exam_records` ADD CONSTRAINT `comp_exam_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cor_uploads` ADD CONSTRAINT `cor_uploads_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cor_records` ADD CONSTRAINT `cor_records_cor_upload_id_fkey` FOREIGN KEY (`cor_upload_id`) REFERENCES `cor_uploads`(`cor_upload_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cor_records` ADD CONSTRAINT `cor_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cor_records` ADD CONSTRAINT `cor_records_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requirements_checklist` ADD CONSTRAINT `requirements_checklist_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs`(`program_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_requirements` ADD CONSTRAINT `student_requirements_requirement_id_fkey` FOREIGN KEY (`requirement_id`) REFERENCES `requirements_checklist`(`requirement_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_requirements` ADD CONSTRAINT `student_requirements_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_requirements` ADD CONSTRAINT `student_requirements_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_requests` ADD CONSTRAINT `adviser_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_requests` ADD CONSTRAINT `adviser_requests_requested_adviser_id_fkey` FOREIGN KEY (`requested_adviser_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_requests` ADD CONSTRAINT `adviser_requests_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_assignments` ADD CONSTRAINT `adviser_assignments_adviser_id_fkey` FOREIGN KEY (`adviser_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_assignments` ADD CONSTRAINT `adviser_assignments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thesis_records` ADD CONSTRAINT `thesis_records_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `adviser_assignments`(`assignment_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thesis_records` ADD CONSTRAINT `thesis_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thesis_titles` ADD CONSTRAINT `thesis_titles_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thesis_documents` ADD CONSTRAINT `thesis_documents_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_set_by_fkey` FOREIGN KEY (`set_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_assignments` ADD CONSTRAINT `panel_assignments_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_assignments` ADD CONSTRAINT `panel_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oral_exam_scores` ADD CONSTRAINT `oral_exam_scores_panel_id_fkey` FOREIGN KEY (`panel_id`) REFERENCES `panel_assignments`(`panel_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oral_exam_scores` ADD CONSTRAINT `oral_exam_scores_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oral_exam_summary` ADD CONSTRAINT `oral_exam_summary_attested_by_fkey` FOREIGN KEY (`attested_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oral_exam_summary` ADD CONSTRAINT `oral_exam_summary_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plagiarism_results` ADD CONSTRAINT `plagiarism_results_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manuscript_submissions` ADD CONSTRAINT `manuscript_submissions_extension_approved_by_fkey` FOREIGN KEY (`extension_approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manuscript_submissions` ADD CONSTRAINT `manuscript_submissions_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manuscript_distributions` ADD CONSTRAINT `manuscript_distributions_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `manuscript_submissions`(`submission_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `acknowledgement_receipts` ADD CONSTRAINT `acknowledgement_receipts_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `acknowledgement_receipts` ADD CONSTRAINT `acknowledgement_receipts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_library` ADD CONSTRAINT `e_library_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `e_library` ADD CONSTRAINT `e_library_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rap_reports` ADD CONSTRAINT `rap_reports_generated_by_fkey` FOREIGN KEY (`generated_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rap_reports` ADD CONSTRAINT `rap_reports_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rap_reports` ADD CONSTRAINT `rap_reports_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rap_report_signatures` ADD CONSTRAINT `rap_report_signatures_rap_id_fkey` FOREIGN KEY (`rap_id`) REFERENCES `rap_reports`(`rap_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rap_report_signatures` ADD CONSTRAINT `rap_report_signatures_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_certifications` ADD CONSTRAINT `adviser_certifications_adviser_id_fkey` FOREIGN KEY (`adviser_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_certifications` ADD CONSTRAINT `adviser_certifications_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `statistician_certifications` ADD CONSTRAINT `statistician_certifications_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grammarian_certifications` ADD CONSTRAINT `grammarian_certifications_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_variable_forms` ADD CONSTRAINT `research_variable_forms_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_var_signatures` ADD CONSTRAINT `research_var_signatures_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_var_signatures` ADD CONSTRAINT `research_var_signatures_var_form_id_fkey` FOREIGN KEY (`var_form_id`) REFERENCES `research_variable_forms`(`var_form_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_evaluation_requests` ADD CONSTRAINT `expert_evaluation_requests_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_evaluation_requests` ADD CONSTRAINT `expert_evaluation_requests_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_evaluations` ADD CONSTRAINT `expert_evaluations_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `expert_evaluation_requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_evaluations` ADD CONSTRAINT `expert_evaluations_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records`(`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memos` ADD CONSTRAINT `memos_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memos` ADD CONSTRAINT `memos_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs`(`program_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_files` ADD CONSTRAINT `student_files_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chatbot_faqs` ADD CONSTRAINT `chatbot_faqs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_calendars` ADD CONSTRAINT `student_calendars_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_year_calendar` ADD CONSTRAINT `school_year_calendar_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_last_modified_by_fkey` FOREIGN KEY (`last_modified_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
