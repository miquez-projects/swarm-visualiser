import React from 'react';
import { Container, Typography, Box, Paper, Link } from '@mui/material';

const PrivacyPolicyPage = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h3" gutterBottom>
          Privacy Policy
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Last Updated: January 14, 2025
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            1. Introduction
          </Typography>
          <Typography paragraph>
            Welcome to Swarm Visualizer ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and protect your information when you use our service.
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            2. Data Controller
          </Typography>
          <Typography paragraph>
            For the purposes of the General Data Protection Regulation (GDPR), the data controller is Swarm Visualizer.
          </Typography>
          <Typography paragraph>
            Contact: Available through the application interface
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            3. Data We Collect
          </Typography>
          <Typography variant="h6" sx={{ mt: 2 }}>
            3.1 Account Information
          </Typography>
          <Typography paragraph>
            When you create an account, we collect:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Authentication credentials (encrypted)</li>
            <li>User preferences and settings</li>
          </Typography>

          <Typography variant="h6" sx={{ mt: 2 }}>
            3.2 Foursquare Data
          </Typography>
          <Typography paragraph>
            When you connect your Foursquare account, we collect and store:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Check-in data (locations, timestamps, photos)</li>
            <li>Venue information</li>
            <li>OAuth access tokens (encrypted)</li>
          </Typography>

          <Typography variant="h6" sx={{ mt: 2 }}>
            3.3 Garmin Data
          </Typography>
          <Typography paragraph>
            When you connect your Garmin account, we collect and store:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Activity data (workouts, routes, statistics)</li>
            <li>Health metrics (steps, heart rate, sleep data)</li>
            <li>OAuth access tokens (encrypted)</li>
          </Typography>

          <Typography variant="h6" sx={{ mt: 2 }}>
            3.4 Usage Data
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Application usage patterns</li>
            <li>Feature interactions</li>
            <li>Error logs and diagnostic information</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            4. How We Use Your Data
          </Typography>
          <Typography paragraph>
            We use your data for the following purposes:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li><strong>Service Provision:</strong> To provide and maintain our visualization services</li>
            <li><strong>Data Visualization:</strong> To create maps and visualizations of your activity data</li>
            <li><strong>Data Synchronization:</strong> To sync data from connected services (Foursquare, Garmin)</li>
            <li><strong>Service Improvement:</strong> To improve and optimize our application</li>
            <li><strong>Support:</strong> To provide customer support and respond to inquiries</li>
            <li><strong>Security:</strong> To detect and prevent fraud and abuse</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            5. Legal Basis for Processing (GDPR)
          </Typography>
          <Typography paragraph>
            Under GDPR, we process your data based on:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li><strong>Consent:</strong> You have given explicit consent for us to process your data for specific purposes</li>
            <li><strong>Contract:</strong> Processing is necessary to fulfill our service agreement with you</li>
            <li><strong>Legitimate Interests:</strong> Processing is necessary for our legitimate interests (e.g., improving our service)</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            6. Data Security
          </Typography>
          <Typography paragraph>
            We implement appropriate technical and organizational measures to protect your data:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>All sensitive data (passwords, OAuth tokens) is encrypted using AES-256 encryption</li>
            <li>Secure HTTPS connections for all data transmission</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Secure database storage with encryption at rest</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            7. Data Sharing and Third Parties
          </Typography>
          <Typography paragraph>
            We do not sell your personal data. We share data only in the following circumstances:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li><strong>Service Providers:</strong> Foursquare and Garmin (to sync your data)</li>
            <li><strong>Hosting Providers:</strong> Render.com (database and application hosting)</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            8. Your Rights (GDPR)
          </Typography>
          <Typography paragraph>
            Under GDPR, you have the following rights:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
            <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
            <li><strong>Right to Restrict Processing:</strong> Request limitation on how we use your data</li>
            <li><strong>Right to Data Portability:</strong> Request your data in a machine-readable format</li>
            <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
          </Typography>
          <Typography paragraph sx={{ mt: 2 }}>
            To exercise these rights, you can:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Delete your account through the application settings</li>
            <li>Disconnect individual services (Foursquare, Garmin) to stop data collection</li>
            <li>Contact us through the application for specific requests</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            9. Data Retention
          </Typography>
          <Typography paragraph>
            We retain your data for as long as your account is active or as needed to provide services. When you delete your account:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>All personal data is permanently deleted from our systems</li>
            <li>This includes all check-ins, activities, photos, and associated metadata</li>
            <li>OAuth tokens are immediately invalidated and deleted</li>
            <li>Anonymized usage statistics may be retained for service improvement</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            10. International Data Transfers
          </Typography>
          <Typography paragraph>
            Your data may be transferred to and processed in countries outside the European Economic Area (EEA). We ensure appropriate safeguards are in place, including:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Standard Contractual Clauses approved by the European Commission</li>
            <li>Encryption during transmission and storage</li>
            <li>Compliance with GDPR requirements for international transfers</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            11. Cookies and Tracking
          </Typography>
          <Typography paragraph>
            We use essential cookies and local storage for:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Authentication and session management</li>
            <li>User preferences and settings</li>
            <li>Application functionality</li>
          </Typography>
          <Typography paragraph>
            We do not use tracking cookies or third-party analytics.
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            12. Children's Privacy
          </Typography>
          <Typography paragraph>
            Our service is not intended for users under the age of 16. We do not knowingly collect data from children under 16. If you believe we have collected data from a child, please contact us immediately.
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            13. Changes to This Policy
          </Typography>
          <Typography paragraph>
            We may update this privacy policy from time to time. We will notify you of material changes by:
          </Typography>
          <Typography component="ul" sx={{ pl: 4 }}>
            <li>Updating the "Last Updated" date</li>
            <li>Displaying a notification in the application</li>
            <li>Requiring re-acceptance for significant changes</li>
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            14. Supervisory Authority
          </Typography>
          <Typography paragraph>
            If you are in the EEA, you have the right to lodge a complaint with your local data protection supervisory authority if you believe we have not complied with data protection laws.
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            15. Contact Us
          </Typography>
          <Typography paragraph>
            If you have questions about this privacy policy or wish to exercise your rights, please contact us through the application interface or visit our{' '}
            <Link href="https://github.com/miquez/swarm-visualiser" target="_blank" rel="noopener">
              GitHub repository
            </Link>.
          </Typography>
        </Box>

        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            © 2025 Swarm Visualizer. All rights reserved.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PrivacyPolicyPage;
