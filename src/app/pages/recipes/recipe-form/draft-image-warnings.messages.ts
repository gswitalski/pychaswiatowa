export function formatUnreadableImagesMessage(indices: number[]): string {
    if (indices.length === 0) {
        return '';
    }

    const formatted =
        indices.length === 1
            ? String(indices[0])
            : indices.length === 2
              ? `${indices[0]} i ${indices[1]}`
              : `${indices.slice(0, -1).join(', ')} i ${indices.at(-1)}`;
    const subject = indices.length === 1 ? 'Zdjęcie' : 'Zdjęcia';
    const verb = indices.length === 1 ? 'było' : 'były';

    const omitted = indices.length === 1 ? 'zostało' : 'zostały';
    return `${subject} ${formatted} ${verb} nieczytelne i ${omitted} pominięte. Sprawdź, czy w przepisie niczego nie brakuje.`;
}
