
def main(result_j: str) -> dict:
    import json
    data = json.loads(result_j)
    if 'download_url' in data:
        return {'result': data['download_url']}
    headers = data[0].keys()
    markdown = "\n\n---\n\n| " + " | ".join(headers) + " |\n"
    markdown += "|" + "|".join(["---"] * len(headers)) + "|\n"
    for row in data:
        markdown += "| " + " | ".join(str(row[h]) for h in headers) + " |\n"
    return {
        "result": markdown
    }

if __name__ == '__main__':
    main("{\"download_url\":\"http://192.168.2.50:9002/uploads/9c60c35a-4b7d-41ef-b470-e967c78ec124.xlsx\",\"message\":\"File generated successfully\"}\n")