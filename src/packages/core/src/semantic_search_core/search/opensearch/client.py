"""OpenSearch client factory."""
import os

from opensearchpy import OpenSearch, RequestsHttpConnection


def get_client() -> OpenSearch:
    """Create an OpenSearch client from environment variables."""
    url = os.environ.get("OPENSEARCH_URL", "http://opensearch:9200")
    username = os.environ.get("OPENSEARCH_USERNAME")
    password = os.environ.get("OPENSEARCH_PASSWORD")

    kwargs = {
        "hosts": [url],
        "use_ssl": url.startswith("https"),
        "verify_certs": False,
        "connection_class": RequestsHttpConnection,
    }
    if username and password:
        kwargs["http_auth"] = (username, password)

    return OpenSearch(**kwargs)
