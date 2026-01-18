const { google } = require('googleapis');

// Map file types to MIME types for Drive queries
const FILE_TYPE_MAP = {
    document: "application/vnd.google-apps.document",
    spreadsheet: "application/vnd.google-apps.spreadsheet",
    presentation: "application/vnd.google-apps.presentation",
    pdf: "application/pdf",
    image: "image/",
    folder: "application/vnd.google-apps.folder"
};

// Get file icon based on MIME type
function getFileIcon(mimeType) {
    if (mimeType?.includes('document')) return '📄';
    if (mimeType?.includes('spreadsheet')) return '📊';
    if (mimeType?.includes('presentation')) return '📽️';
    if (mimeType?.includes('pdf')) return '📕';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('folder')) return '📁';
    if (mimeType?.includes('video')) return '🎬';
    if (mimeType?.includes('audio')) return '🎵';
    return '📎';
}

class DriveService {
    constructor(authClient) {
        this.drive = google.drive({ version: 'v3', auth: authClient });
        this.docs = google.docs({ version: 'v1', auth: authClient });
    }

    async searchFiles(query, fileType, maxResults = 10) {
        const limit = Math.min(maxResults, 25);
        let driveQuery = `name contains '${query}' or fullText contains '${query}'`;

        if (fileType && fileType !== 'any') {
            const mimeType = FILE_TYPE_MAP[fileType];
            if (mimeType) {
                if (fileType === 'image') {
                    driveQuery += ` and mimeType contains 'image/'`;
                } else {
                    driveQuery += ` and mimeType = '${mimeType}'`;
                }
            }
        }

        driveQuery += ' and trashed = false';

        const response = await this.drive.files.list({
            q: driveQuery,
            pageSize: limit,
            fields: 'files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size, owners)',
            orderBy: 'modifiedTime desc'
        });

        const files = (response.data.files || []).map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            icon: getFileIcon(file.mimeType),
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            size: file.size,
            owner: file.owners?.[0]?.emailAddress || 'Unknown'
        }));

        return {
            success: true,
            files,
            count: files.length,
            query
        };
    }

    async getRecentFiles(maxResults = 10, fileType = 'any') {
        const limit = Math.min(maxResults, 25);
        let query = 'trashed = false';

        if (fileType && fileType !== 'any') {
            const mimeType = FILE_TYPE_MAP[fileType];
            if (mimeType) {
                if (fileType === 'image') {
                    query += ` and mimeType contains 'image/'`;
                } else {
                    query += ` and mimeType = '${mimeType}'`;
                }
            }
        }

        const response = await this.drive.files.list({
            q: query,
            pageSize: limit,
            fields: 'files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size, owners)',
            orderBy: 'modifiedTime desc'
        });

        const files = (response.data.files || []).map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            icon: getFileIcon(file.mimeType),
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            size: file.size,
            owner: file.owners?.[0]?.emailAddress || 'Unknown'
        }));

        return {
            success: true,
            files,
            count: files.length
        };
    }

    async getFileContent(fileId) {
        const fileMeta = await this.drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, webViewLink'
        });

        const mimeType = fileMeta.data.mimeType;
        let content = '';

        if (mimeType === 'application/vnd.google-apps.document') {
            const doc = await this.docs.documents.get({
                documentId: fileId
            });

            const extractText = (content) => {
                let text = '';
                if (content.content) {
                    for (const element of content.content) {
                        if (element.paragraph) {
                            for (const elem of element.paragraph.elements || []) {
                                if (elem.textRun) {
                                    text += elem.textRun.content;
                                }
                            }
                        }
                    }
                }
                return text;
            };

            content = extractText(doc.data.body);
        }
        else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            const response = await this.drive.files.export({
                fileId: fileId,
                mimeType: 'text/csv'
            });
            content = response.data;
        }
        else if (mimeType === 'application/vnd.google-apps.presentation') {
            const response = await this.drive.files.export({
                fileId: fileId,
                mimeType: 'text/plain'
            });
            content = response.data;
        }
        else {
            try {
                const response = await this.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            } catch (e) {
                content = '[Unable to read file content. File may be binary or too large.]';
            }
        }

        return {
            success: true,
            file: {
                id: fileMeta.data.id,
                name: fileMeta.data.name,
                mimeType: fileMeta.data.mimeType,
                icon: getFileIcon(fileMeta.data.mimeType),
                webViewLink: fileMeta.data.webViewLink,
                content: content.slice(0, 10000)
            }
        };
    }

    async createDocument(title, content) {
        const doc = await this.docs.documents.create({
            requestBody: {
                title: title
            }
        });

        if (content) {
            await this.docs.documents.batchUpdate({
                documentId: doc.data.documentId,
                requestBody: {
                    requests: [{
                        insertText: {
                            location: { index: 1 },
                            text: content
                        }
                    }]
                }
            });
        }

        const fileMeta = await this.drive.files.get({
            fileId: doc.data.documentId,
            fields: 'webViewLink'
        });

        return {
            success: true,
            document: {
                id: doc.data.documentId,
                title: doc.data.title,
                webViewLink: fileMeta.data.webViewLink,
                hasContent: !!content
            },
            message: `Document "${title}" created successfully!`
        };
    }
}

module.exports = DriveService;
